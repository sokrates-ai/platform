// server.js
'use strict';

const http = require('http');
const url = require('url');
const jwt = require('jsonwebtoken');
const IORedis = require('ioredis');
const { Hocuspocus } = require('@hocuspocus/server');
const { Redis: RedisExtension } = require('@hocuspocus/extension-redis');
const { Database } = require('@hocuspocus/extension-database');
const Y = require('yjs');
const { request } = require('undici');
const pino = require('pino');
const pinoHttp = require('pino-http');

function requireEnv(name) {
  const v = process.env[name];
  if (v === undefined || v === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

const NODE_ENV = requireEnv('NODE_ENV');
const LOG_LEVEL = requireEnv('LOG_LEVEL').toLowerCase();
const LOG_PRETTY = requireEnv('LOG_PRETTY').toLowerCase() === 'true';

const logger = pino({
  level: LOG_LEVEL,
  transport: LOG_PRETTY && NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' },
  } : undefined,
});
const ADDRESS = requireEnv('COLLAB_BIND_ADDRESS');

const PORT = Number(requireEnv('COLLAB_WS_PORT'));
const BRIDGE_PORT = Number(requireEnv('COLLAB_BRIDGE_PORT'));

logger.info({ BRIDGE_PORT }, 'Using bridge port')

const INSTANCE_NAME = requireEnv('COLLAB_INSTANCE_NAME');

const REDIS_HOST = requireEnv('COLLAB_REDIS_HOST');
const REDIS_PORT = requireEnv('COLLAB_REDIS_PORT');
const REDIS_URL = `redis://${REDIS_HOST}:${REDIS_PORT}`

logger.info({ REDIS_URL }, 'Using REDIS url')
const REDIS_PREFIX = requireEnv('COLLAB_REDIS_PREFIX');     // used by hocuspocus redis extension
const PERSIST_PREFIX = requireEnv('COLLAB_PERSIST_PREFIX');  // used by our persistence

const COLLAB_JWT_SECRET = requireEnv('SHARED_COLLAB_JWT_SECRET');
const API_URL = requireEnv('COLLAB_API_BASE_URL').replace(/\/$/, '');

const STORE_DEBOUNCE = Number(requireEnv('COLLAB_STORE_DEBOUNCE_MS'));
const STORE_MAX_DEBOUNCE = Number(requireEnv('COLLAB_STORE_MAX_DEBOUNCE_MS'));
const DIRECT_CONN_IDLE_MS = Number(requireEnv('COLLAB_DIRECT_CONN_IDLE_MS'));
const BODY_LIMIT_BYTES = Number(requireEnv('COLLAB_BODY_LIMIT_BYTES'));

const redis = new IORedis(REDIS_URL, {
	enableAutoPipelining: true,
	maxRetriesPerRequest: null,
	reconnectOnError: () => true,
	retryStrategy(times) {
		const delay = Math.min(times * 200, 2000);
		console.warn(`[redis] reconnecting in ${delay}ms (attempt ${times})`);
		return delay;
	},
});

redis.on('connect', () => logger.info('[redis] connected'));
redis.on('end', () => logger.warn('[redis] disconnected'));
redis.on('error', (err) => logger.error({ err }, '[redis] error'));

const database = new Database({
	fetch: async ({ documentName }) => {
		const key = `${PERSIST_PREFIX}${documentName}`;
		try {
			const buf = await redis.getBuffer(key);
			return buf || null;
		} catch (err) {
			logger.error({ err, documentName }, '[db.fetch] error');
			return null;
		}
	},
	store: async ({ documentName, state }) => {
		const key = `${PERSIST_PREFIX}${documentName}`;
		try {
			await redis.set(key, Buffer.from(state));
		} catch (err) {
			logger.error({ err, documentName }, '[db.store] error');
		}
	},
});


const server = new Hocuspocus({
	name: INSTANCE_NAME,
	address: ADDRESS,
	port: PORT,

	// Debounce persistence to reduce store lock pressure
	debounce: STORE_DEBOUNCE,
	maxDebounce: STORE_MAX_DEBOUNCE,

	// Auth: accept token param or Authorization: Bearer <token>
	onAuthenticate: async ({ token, requestHeaders, requestParameters }) => {
		const bearer = (requestHeaders?.authorization || '').replace(/^Bearer\s+/i, '');
		const raw = token || requestParameters?.get('token') || bearer;
		if (!raw) {
			const err = new Error('No token provided');
			err.code = 4401;
			throw err;
		}
		try {
			const payload = jwt.verify(raw, COLLAB_JWT_SECRET);
			// put whatever you need into the connection context
			return { user: payload };
		} catch {
			const err = new Error('Unauthorized');
			err.code = 4401;
			throw err;
		}
	},

	// Ensure base maps exist (do not overwrite any existing content)
	onLoadDocument: async ({ document }) => {
		document.transact(() => {
			document.getMap('content');
			document.getMap('runtime');
			document.getMap('jobs');
		});
		return document;
	},

	// Stateless RPC from clients (forward to API + optimistic job status)
	onStateless: async ({ payload, document, documentName }) => {
		let msg;
		try {
			msg = JSON.parse(String(payload || '{}')) || {};
		} catch {
			return;
		}

		const type = String(msg.type || msg.kind || '');
		if (!type || !documentName) return;

		const jobId = typeof msg.jobId === 'string' ? msg.jobId : (msg.id ? String(msg.id) : undefined);

		// Optimistically mark the job as queued until the API posts an actual
		// progress update back to the collaboration bridge.
		if (jobId) {
			document.transact(() => {
				const jobs = document.getMap('jobs');
				const prev = jobs.get(jobId) || {};
				jobs.set(jobId, {
					...prev,
					status: 'queued',
					createdAt: prev.createdAt || Date.now(),
					kind: type,
					updatedAt: Date.now(),
				});
				// For text evaluation, clear previous feedback to avoid showing stale comments
				try {
					if (type === 'text.eval' || type === 'evaluate') {
						const runtime = document.getMap('runtime');
						runtime.delete('text:feedback');
					}
				} catch {}
			});
		}

		// forward to API
		try {
			await postJson(
				type === 'text.eval' || type === 'evaluate'
					? `${API_URL}/v1/text/${encodeURIComponent(documentName)}/jobs`
					: type === 'code.run'
						? `${API_URL}/v1/code/${encodeURIComponent(documentName)}/runs`
						: type === 'code.judge' || type === 'code.judgement'
							? `${API_URL}/v1/code/${encodeURIComponent(documentName)}/judgements`
							: '',
				buildApiPayload(type, msg, jobId),
			);
		} catch (err) {
			// reflect API failure back into the doc
			if (jobId) {
				document.transact(() => {
					const jobs = document.getMap('jobs');
					const prev = jobs.get(jobId) || {};
					jobs.set(jobId, { ...prev, status: 'error', error: 'api_request_failed', updatedAt: Date.now() });
				});
			}
			logger.error({ err, type, documentName, jobId }, '[onStateless] forward to API failed');
		}
	},

	extensions: [
		// Sync/awareness & cross-instance store locking via Redis
		new RedisExtension({
            host: REDIS_HOST,
            port: REDIS_PORT,
			prefix: REDIS_PREFIX,
		}),
		database,
	],
});

server.listen();
logger.info({ address: ADDRESS, port: PORT, instance: INSTANCE_NAME }, 'Collab websocket started');


const directPool = (() => {
	/** @type {Map<string, {dc: import('@hocuspocus/server').DirectConnection, timer?: NodeJS.Timeout}>} */
	const map = new Map();

	async function get(documentName) {
		const entry = map.get(documentName);
		if (entry) {
			if (entry.timer) clearTimeout(entry.timer);
			return entry.dc;
		}
		const dc = await server.openDirectConnection(documentName, {});
		map.set(documentName, { dc });
		return dc;
	}

	function release(documentName) {
		const entry = map.get(documentName);
		if (!entry) return;
		if (entry.timer) clearTimeout(entry.timer);
		entry.timer = setTimeout(async () => {
			try {
				await entry.dc.disconnect();
			} catch (err) {
				logger.warn({ documentName, err }, '[directPool] disconnect error');
			} finally {
				map.delete(documentName);
			}
		}, DIRECT_CONN_IDLE_MS);
	}

	async function shutdown() {
		await Promise.allSettled(
			Array.from(map.values()).map((e) => e.dc.disconnect().catch(() => { })),
		);
		map.clear();
	}

	return { get, release, shutdown };
})();


const httpLogger = pinoHttp({ logger });
const serverHttp = http.createServer(async (req, res) => {
	httpLogger(req, res);
	// health
	if (req.method === 'GET' && req.url && req.url.startsWith('/healthz')) {
		res.writeHead(200, { 'Content-Type': 'application/json' });
		return res.end(JSON.stringify({
			status: 'ok',
			name: INSTANCE_NAME,
			pid: process.pid,
			time: new Date().toISOString(),
			env: NODE_ENV,
		}));
		// eslint-disable-next-line no-else-return
	} else {
		const parsed = url.parse(req.url || '', true);
		const match = /^\/workspaces\/([^/]+)\/result$/.exec(parsed.pathname || '');

		if (req.method === 'POST' && match) {
			const workspaceId = decodeURIComponent(match[1]);

			let body;
			try {
				body = await parseJsonBody(req, BODY_LIMIT_BYTES);
			} catch {
				res.writeHead(413, { 'Content-Type': 'application/json' });
				return res.end(JSON.stringify({ error: 'invalid_or_too_large_body' }));
			}

			try {
				const dc = await directPool.get(workspaceId);

				await dc.transact((doc) => {
					ensureStructure(doc);
					applyJobUpdate(doc, body);
				});

				// release (disconnect after idle)
				directPool.release(workspaceId);

				res.writeHead(204);
				return res.end();
			} catch (err) {
				console.error('[bridge] failed to update doc', { workspaceId, err });
				res.writeHead(409, { 'Content-Type': 'application/json' });
				return res.end(JSON.stringify({ error: 'conflict_or_locked' }));
			}
		}
	}

	res.writeHead(404, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify({ error: 'not_found' }));
});

serverHttp.listen(BRIDGE_PORT, ADDRESS, () => {
	logger.info({ address: ADDRESS, port: BRIDGE_PORT }, 'Bridge HTTP listening');
});

async function postJson(u, body) {
	if (!u) return;
	const res = await request(u, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body || {}),
	});
	if (res.statusCode >= 400) {
		const text = await res.body.text();
		const err = new Error(`POST ${u} failed: ${res.statusCode} ${text}`);
		err.statusCode = res.statusCode;
		throw err;
	}
	try {
		return await res.body.json();
	} catch {
		return null;
	}
}

function buildApiPayload(type, msg, jobId) {
	if (type === 'text.eval' || type === 'evaluate') {
		return { submission: String(msg.submission || ''), jobId };
	}
	if (type === 'code.run') {
		return {
			languageId: Number(msg.languageId || 71),
			source: String(msg.source || ''),
			stdin: typeof msg.stdin === 'string' ? msg.stdin : undefined,
			jobId,
		};
	}
	if (type === 'code.judge' || type === 'code.judgement') {
		const tests = Array.isArray(msg.tests) ? msg.tests : [];
		return {
			languageId: Number(msg.languageId || 71),
			source: String(msg.source || ''),
			tests,
			jobId,
		};
	}
	return {};
}

function ensureStructure(doc /* Y.Doc */) {
	doc.getMap('jobs');
	doc.getMap('runtime');
}

function applyJobUpdate(doc /* Y.Doc */, body) {
	const jobs = doc.getMap('jobs');
	const runtime = doc.getMap('runtime');

	const jobId = String(body.jobId || '');
	const cellId = body.cellId ? String(body.cellId) : '';

	if (!jobId) return;

	if (Object.prototype.hasOwnProperty.call(body, 'error')) {
		const prev = jobs.get(jobId) || {};
		jobs.set(jobId, {
			...prev,
			status: 'error',
			error: body.error,
			finishedAt: Date.now(),
			updatedAt: Date.now(),
		});
		return;
	}

	if (Object.prototype.hasOwnProperty.call(body, 'progress') ||
		Object.prototype.hasOwnProperty.call(body, 'progressText')) {
		const prev = jobs.get(jobId) || {};
		const patch = {};
		if (typeof body.progress === 'number') patch.progress = body.progress;
		if (typeof body.progressText === 'string') patch.progressText = body.progressText;
		jobs.set(jobId, {
			...prev,
			status: 'running',
			startedAt: prev.startedAt || Date.now(),
			...patch,
			updatedAt: Date.now(),
		});
		return;
	}

	if (Object.prototype.hasOwnProperty.call(body, 'value')) {
		const key = cellId || `job:${jobId}`;
		runtime.set(key, { status: 'done', value: body.value, updatedAt: Date.now() });
		const prev = jobs.get(jobId) || {};
		jobs.set(jobId, { ...prev, status: 'done', finishedAt: Date.now(), updatedAt: Date.now() });
	}
}

function parseJsonBody(req, limit) {
	return new Promise((resolve, reject) => {
		let received = 0;
		const chunks = [];
		req.on('data', (chunk) => {
			received += chunk.length;
			if (received > limit) {
				reject(new Error('body_too_large'));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on('end', () => {
			try {
				const text = Buffer.concat(chunks).toString('utf8');
				resolve(text ? JSON.parse(text) : {});
			} catch (err) {
				reject(err);
			}
		});
		req.on('error', reject);
	});
}


function shutdown() {
	logger.info('Shutting down …');
	// TODO: when we catch errors, we should log them
	try { server.destroy(); } catch {}
	serverHttp.close(() => logger.info('HTTP server closed'));
	directPool.shutdown().finally(() => {
		redis.quit().finally(() => process.exit(0));
	});
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
