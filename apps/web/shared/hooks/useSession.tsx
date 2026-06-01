"use client";

import { getAPIUrl } from '@services/config/config'
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { ApiClient, Exercise, RateLimit, UserStats, WorkspaceInfo } from "@/shared/services/api";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useParams } from "next/navigation";
import type { Awareness } from "y-protocols/awareness";

interface SessionUser {
  id: string;
  name: string;
  color: string;
}

type WorkspaceWebsocketStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected';

type WorkspaceWebsocketDebugEventKind =
  | 'lifecycle'
  | 'status'
  | 'auth'
  | 'sync'
  | 'awareness'
  | 'stateless'
  | 'error';

export interface WorkspaceWebsocketDebugEvent {
  id: string;
  at: number;
  kind: WorkspaceWebsocketDebugEventKind;
  label: string;
  detail?: string | null;
}

export interface WorkspaceWebsocketDebugState {
  documentName: string | null;
  serverUrl: string | null;
  status: WorkspaceWebsocketStatus;
  websocketReadyState: number | null;
  connected: boolean;
  authenticated: boolean;
  synced: boolean;
  unsyncedChanges: number;
  hasUnsyncedChanges: boolean;
  awarenessUsers: number;
  incomingMessages: number;
  outgoingMessages: number;
  statelessIncoming: number;
  statelessOutgoing: number;
  lastIncomingMessage: string | null;
  lastOutgoingMessage: string | null;
  lastMessageReceivedAt: number | null;
  lastError: string | null;
  events: WorkspaceWebsocketDebugEvent[];
}

type WorkspaceBlockingErrorCode =
  | 'collab_permission_denied'
  | 'workspace_session_invalid'
  | 'collab_configuration_error';

export interface WorkspaceBlockingError {
  code: WorkspaceBlockingErrorCode;
  title: string;
  message: string;
  detail?: string | null;
}

interface SessionContextType {
  token: string | null;
  isConnected: boolean;
  exercise: Exercise | null;
  workspaceContent: string;
  rateLimit: RateLimit | null;
  apiClient: ApiClient | null;
  isInitialContentLoaded: boolean;
  updateWorkspaceContent: (content: string) => void;
  refreshRateLimit: () => Promise<void>;
  refreshUserStats: () => Promise<void>;
  ydoc: Y.Doc | null;
  provider: HocuspocusProvider | null;
  awareness: Awareness | null;
  currentUser: SessionUser | null;
  workspaceInfo: WorkspaceInfo | null;
  jobsActive: boolean;
  jobsRunning: boolean;
  activeJobStatus: 'queued' | 'running' | null;
  latestJobText: string;
  latestTextResult: { status: 'success' | 'fail'; text: string; updatedAt: number } | null;
  latestTextFeedback: any | null;
  latestTextFeedbackUpdatedAt: number | null;
  commentsVisible: boolean;
  setCommentsVisible: (v: boolean) => void;
  taskJustChanged: boolean;
  userStats: UserStats | null;
  websocketDebug: WorkspaceWebsocketDebugState;
  clearWebsocketDebugEvents: () => void;
  workspaceBlockingError: WorkspaceBlockingError | null;
}

const SessionContext = createContext<SessionContextType | null>(null);

interface SessionProviderProps {
  children: React.ReactNode;
}

const DEFAULT_TEXT_JOB_ERROR =
  'AI feedback is temporarily unavailable. Your draft is still saved. Please try again in a moment.';

const normalizeTextJobError = (value: unknown) => {
  if (typeof value !== 'string') return DEFAULT_TEXT_JOB_ERROR;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'api_request_failed') {
    return 'AI feedback could not be requested right now. Your draft is still saved. Please try again in a moment.';
  }
  return trimmed;
};

type LatestTextFeedbackCandidate =
  | { kind: 'feedback'; ts: number; payload: any }
  | { kind: 'error'; ts: number; message: string };

const MAX_WEBSOCKET_DEBUG_EVENTS = 60;

const truncateWebsocketDebugText = (value: string, max = 220) => {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
};

const summarizeWebsocketCloseEvent = (event: unknown) => {
  if (!event || typeof event !== 'object') return null;
  const maybeEvent = event as { code?: unknown; reason?: unknown };
  const parts = [];
  if (typeof maybeEvent.code === 'number') {
    parts.push(`code ${maybeEvent.code}`);
  }
  if (typeof maybeEvent.reason === 'string' && maybeEvent.reason.trim()) {
    parts.push(maybeEvent.reason.trim());
  }
  return parts.length ? parts.join(' • ') : null;
};

const summarizeOutgoingMessage = (message: unknown) => {
  if (!message || typeof message !== 'object') return 'outgoing message';
  const maybeMessage = message as {
    constructor?: { name?: string };
    type?: unknown;
  };
  const parts = [];
  if (typeof maybeMessage.constructor?.name === 'string') {
    parts.push(maybeMessage.constructor.name);
  }
  if (typeof maybeMessage.type === 'number') {
    parts.push(`type ${maybeMessage.type}`);
  }
  return parts.length ? parts.join(' • ') : 'outgoing message';
};

const summarizeIncomingMessage = (event: unknown) => {
  if (!event || typeof event !== 'object') return 'incoming message';
  const data = (event as { data?: unknown }).data;
  if (typeof data === 'string') {
    return truncateWebsocketDebugText(data);
  }
  if (data instanceof ArrayBuffer) {
    return `binary ${data.byteLength}b`;
  }
  if (ArrayBuffer.isView(data)) {
    return `binary ${data.byteLength}b`;
  }
  return 'incoming message';
};

const summarizeStatelessPayload = (payload: unknown) => {
  if (typeof payload !== 'string') return 'stateless payload';
  return truncateWebsocketDebugText(payload);
};

const createDefaultWebsocketDebugState = (
  documentName: string | null = null
): WorkspaceWebsocketDebugState => ({
  documentName,
  serverUrl: null,
  status: 'idle',
  websocketReadyState: null,
  connected: false,
  authenticated: false,
  synced: false,
  unsyncedChanges: 0,
  hasUnsyncedChanges: false,
  awarenessUsers: 0,
  incomingMessages: 0,
  outgoingMessages: 0,
  statelessIncoming: 0,
  statelessOutgoing: 0,
  lastIncomingMessage: null,
  lastOutgoingMessage: null,
  lastMessageReceivedAt: null,
  lastError: null,
  events: [],
});

const normalizeBlockingErrorDetail = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const buildWorkspaceBlockingError = (
  reason: unknown
): WorkspaceBlockingError | null => {
  const detail = normalizeBlockingErrorDetail(reason);
  if (!detail) return null;

  const normalized = detail.toLowerCase();

  if (
    normalized.includes('permission-denied') ||
    normalized.includes('permission denied') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden') ||
    normalized.includes('no token provided')
  ) {
    return {
      code: 'collab_permission_denied',
      title: 'Workspace Access Denied',
      message:
        'The collaboration server denied access to this workspace. Editing has been blocked to prevent you from working in a broken session.',
      detail,
    };
  }

  if (
    normalized.includes('invalid session token') ||
    normalized.includes('session token not found') ||
    normalized.includes('failed to obtain collaboration token')
  ) {
    return {
      code: 'workspace_session_invalid',
      title: 'Workspace Session Expired',
      message:
        'This workspace session is no longer valid. Reload the workspace from the activity page before continuing.',
      detail,
    };
  }

  if (
    normalized.includes('next_public_collab_ws_url') ||
    normalized.includes('collaboration token') ||
    normalized.includes('collab')
  ) {
    return {
      code: 'collab_configuration_error',
      title: 'Workspace Collaboration Unavailable',
      message:
        'The workspace collaboration channel is misconfigured or unavailable. Editing has been blocked until the connection issue is resolved.',
      detail,
    };
  }

  return null;
};

export function SessionProvider({ children }: SessionProviderProps) {
  const params = useParams();
  const workspaceId = (params as any)?.workspaceId as string | undefined;

  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [workspaceContent, setWorkspaceContent] = useState("");
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null);
  const [apiClient, setApiClient] = useState<ApiClient | null>(null);
  const [isInitialContentLoaded, setIsInitialContentLoaded] = useState(false);
  const [workspaceInfo, setWorkspaceInfo] = useState<WorkspaceInfo | null>(null);
  const [taskJustChanged, setTaskJustChanged] = useState(false);
  const hasSeenWorkspaceUpdateRef = useRef(false);
  const lastWorkspaceUpdateAtRef = useRef<number>(0);

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const [runtimeSnap, setRuntimeSnap] = useState<Record<string, any>>({});
  const [jobsSnap, setJobsSnap] = useState<Record<string, any>>({});

  const lastHtmlRef = useRef<string>("");
  const lastPersistedContentRef = useRef<string>("");
  const contentSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [websocketDebug, setWebsocketDebug] = useState<WorkspaceWebsocketDebugState>(
    () => createDefaultWebsocketDebugState(workspaceId ?? null)
  );
  const [workspaceBlockingError, setWorkspaceBlockingError] =
    useState<WorkspaceBlockingError | null>(null);
  const lastLoggedBlockingErrorRef = useRef<string>('');

  const syncWebsocketDebugSnapshot = useCallback(
    (
      provider: HocuspocusProvider | null,
      extra?: Partial<WorkspaceWebsocketDebugState>
    ) => {
      setWebsocketDebug((prev) => {
        const websocketProvider = provider?.configuration?.websocketProvider;
        const next: WorkspaceWebsocketDebugState = {
          ...prev,
          documentName: provider?.configuration?.name ?? prev.documentName,
          serverUrl:
            typeof websocketProvider?.url === 'string'
              ? websocketProvider.url
              : prev.serverUrl,
          status:
            (provider?.status as WorkspaceWebsocketStatus | undefined) ??
            prev.status,
          websocketReadyState:
            typeof websocketProvider?.webSocket?.readyState === 'number'
              ? websocketProvider.webSocket.readyState
              : prev.websocketReadyState,
          connected:
            (provider?.status as WorkspaceWebsocketStatus | undefined) ===
            'connected',
          authenticated: Boolean(provider?.isAuthenticated ?? prev.authenticated),
          synced: Boolean((provider as any)?.isSynced ?? prev.synced),
          unsyncedChanges: Number(
            provider?.unsyncedChanges ?? prev.unsyncedChanges ?? 0
          ),
          hasUnsyncedChanges: Boolean(
            provider?.hasUnsyncedChanges ?? prev.hasUnsyncedChanges
          ),
          awarenessUsers: provider?.awareness
            ? Array.from(provider.awareness.getStates().values()).length
            : prev.awarenessUsers,
          lastMessageReceivedAt:
            typeof websocketProvider?.lastMessageReceived === 'number' &&
            websocketProvider.lastMessageReceived > 0
              ? websocketProvider.lastMessageReceived
              : prev.lastMessageReceivedAt,
        };

        return {
          ...next,
          ...extra,
        };
      });
    },
    []
  );

  const recordWebsocketDebugEvent = useCallback(
    (
      provider: HocuspocusProvider | null,
      event: {
        kind: WorkspaceWebsocketDebugEventKind;
        label: string;
        detail?: string | null;
      },
      updater?: (
        prev: WorkspaceWebsocketDebugState
      ) => Partial<WorkspaceWebsocketDebugState>
    ) => {
      setWebsocketDebug((prev) => {
        const websocketProvider = provider?.configuration?.websocketProvider;
        const nextEvent: WorkspaceWebsocketDebugEvent = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          at: Date.now(),
          kind: event.kind,
          label: event.label,
          detail: event.detail ?? null,
        };

        const base: WorkspaceWebsocketDebugState = {
          ...prev,
          documentName: provider?.configuration?.name ?? prev.documentName,
          serverUrl:
            typeof websocketProvider?.url === 'string'
              ? websocketProvider.url
              : prev.serverUrl,
          status:
            (provider?.status as WorkspaceWebsocketStatus | undefined) ??
            prev.status,
          websocketReadyState:
            typeof websocketProvider?.webSocket?.readyState === 'number'
              ? websocketProvider.webSocket.readyState
              : prev.websocketReadyState,
          connected:
            (provider?.status as WorkspaceWebsocketStatus | undefined) ===
            'connected',
          authenticated: Boolean(provider?.isAuthenticated ?? prev.authenticated),
          synced: Boolean((provider as any)?.isSynced ?? prev.synced),
          unsyncedChanges: Number(
            provider?.unsyncedChanges ?? prev.unsyncedChanges ?? 0
          ),
          hasUnsyncedChanges: Boolean(
            provider?.hasUnsyncedChanges ?? prev.hasUnsyncedChanges
          ),
          awarenessUsers: provider?.awareness
            ? Array.from(provider.awareness.getStates().values()).length
            : prev.awarenessUsers,
          lastMessageReceivedAt:
            typeof websocketProvider?.lastMessageReceived === 'number' &&
            websocketProvider.lastMessageReceived > 0
              ? websocketProvider.lastMessageReceived
              : prev.lastMessageReceivedAt,
        };

        return {
          ...base,
          ...(updater ? updater(base) : {}),
          events: [nextEvent, ...prev.events].slice(0, MAX_WEBSOCKET_DEBUG_EVENTS),
        };
      });
    },
    []
  );

  const clearWebsocketDebugEvents = useCallback(() => {
    setWebsocketDebug((prev) => ({
      ...prev,
      events: [],
    }));
  }, []);

  useEffect(() => {
    if (!workspaceBlockingError) {
      lastLoggedBlockingErrorRef.current = '';
      return;
    }

    const signature = JSON.stringify({
      code: workspaceBlockingError.code,
      detail: workspaceBlockingError.detail ?? '',
      documentName: websocketDebug.documentName ?? '',
      serverUrl: websocketDebug.serverUrl ?? '',
    });

    if (signature === lastLoggedBlockingErrorRef.current) {
      return;
    }

    lastLoggedBlockingErrorRef.current = signature;

    console.error('[workspace] blocking error', {
      error: workspaceBlockingError,
      websocket: {
        documentName: websocketDebug.documentName,
        serverUrl: websocketDebug.serverUrl,
        status: websocketDebug.status,
        websocketReadyState: websocketDebug.websocketReadyState,
        authenticated: websocketDebug.authenticated,
        synced: websocketDebug.synced,
        unsyncedChanges: websocketDebug.unsyncedChanges,
      },
    });
  }, [workspaceBlockingError, websocketDebug]);

  // Derive a lightweight current user from token
  const currentUserRef = useRef<SessionUser | null>(null);
  if (!currentUserRef.current && typeof window !== "undefined") {
    const namePool = [
      "Plato","Aristotle","Pythagoras","Euclid","Archimedes","Hypatia","Descartes","Spinoza","Leibniz",
      "Newton","Galileo","Kepler","Copernicus","Faraday","Maxwell","Curie","Einstein","Bohr","Feynman",
      "Turing","Lovelace","Noether","Gauss","Riemann","Euler","Pascal","Laplace","Hawking","Dirac",
      "Heisenberg","Planck","Schrodinger","Hubble","Tesla","Edison","Franklin","Pasteur","Darwin","Mendel",
      "Aristarchus","Avicenna","Alhazen","Fermat","Cantor","Gödel","Ramanujan","Shannon","Salk","Crick"
    ];

    // Stable, per-tab UUID-like id (not shown as name)
    let tabId = "";
    try {
      tabId = sessionStorage.getItem("tab-id") || "";
      if (!tabId) {
        tabId = Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem("tab-id", tabId);
      }
    } catch {
      tabId = Math.random().toString(36).slice(2, 10);
    }

    // Pick and persist a name from the pool for this tab
    let displayName = "";
    try {
      displayName = sessionStorage.getItem("display-name") || "";
      if (!displayName) {
        const index = Math.floor(Math.random() * namePool.length);
        displayName = namePool[index];
        sessionStorage.setItem("display-name", displayName);
      }
    } catch {
      const index = Math.floor(Math.random() * namePool.length);
      displayName = namePool[index];
    }

    // Deterministic color from id+name
    const colors = ["#D83A52", "#E67E22", "#F1C40F", "#2ECC71", "#1ABC9C", "#3498DB", "#9B59B6", "#E84393"];
    const seed = `${tabId}:${displayName}`;
    const hash = Array.from(seed).reduce((acc, c) => (acc + c.charCodeAt(0)) % colors.length, 0);

    currentUserRef.current = {
      id: `tab:${tabId}`,
      name: displayName,
      color: colors[hash],
    };
  }

  // Set token and API client from route param
  useEffect(() => {
    if (!workspaceId) return;
    setToken(workspaceId);
    setApiClient(new ApiClient(workspaceId));
    setWebsocketDebug(createDefaultWebsocketDebugState(workspaceId));
    setWorkspaceBlockingError(null);
  }, [workspaceId]);

  // Initialize session HTTP state
  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    const client = apiClient ?? new ApiClient(token);
    if (!apiClient) setApiClient(client);

    const initializeSession = async () => {
      try {
        const [exerciseData, workspaceInfoData, workspaceStateData] = await Promise.all([
          client.getExercise(),
          client.getWorkspaceInfo(),
          client.getWorkspaceState().catch(() => ({ content: '' })),
        ]);

        if (isMounted) {
          const savedContent =
            typeof workspaceStateData?.content === 'string'
              ? workspaceStateData.content
              : '';
          setExercise(exerciseData);
          setWorkspaceInfo(workspaceInfoData);
          setWorkspaceContent(savedContent);
          lastHtmlRef.current = savedContent;
          lastPersistedContentRef.current = savedContent;
          const kind = workspaceInfoData.workspaceType === 'text' ? 'text.eval' : (workspaceInfoData.workspaceType === 'code' ? 'code.run' : 'flashcard.validate');
          setRateLimit(await client.getRateLimit(kind));
          setIsInitialContentLoaded(true);
        }
      } catch (error) {
        console.error("Failed to initialize session:", error);
      }
    };

    initializeSession();

    return () => {
      isMounted = false;
    };
  }, [token, apiClient]);

  // Setup Yjs + Hocuspocus provider
  useEffect(() => {
    if (!workspaceId || !token) return;

    let cancelled = false;
    let detachDebugListeners: (() => void) | null = null;

    const connect = async () => {
      setWebsocketDebug(createDefaultWebsocketDebugState(workspaceId));
      setWorkspaceBlockingError(null);
      try {
        const apiBase = getAPIUrl().replace(/\/$/, '')
        const resp = await fetch(`${apiBase}/workspaces/${encodeURIComponent(workspaceId)}/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!resp.ok) {
          let detail = `Failed to obtain collaboration token (${resp.status})`;
          try {
            const payload = await resp.json();
            if (typeof payload?.detail === 'string' && payload.detail.trim()) {
              detail = payload.detail.trim();
            }
          } catch {}
          throw new Error(detail);
        }
        const { token: collabToken } = await resp.json();

        if (cancelled) return;

        const collabUrl = (() => {
          const value = process.env.NEXT_PUBLIC_COLLAB_WS_URL;
          if (!value) throw new Error('Missing NEXT_PUBLIC_COLLAB_WS_URL');
          return value;
        })();

        const provider = new HocuspocusProvider({
          url: collabUrl,
          name: workspaceId,
          token: collabToken,
        });

        const doc = provider.document as Y.Doc;
        const originalSendStateless = provider.sendStateless.bind(provider);

        const handleStatus = (payload: { status: string }) => {
          const status = payload.status === 'connected';
          setIsConnected(status);
          if (status) {
            setWorkspaceBlockingError(null);
          }
          recordWebsocketDebugEvent(
            provider,
            {
              kind: 'status',
              label: `status:${payload.status}`,
            },
            () => ({
              connected: status,
              ...(status ? { lastError: null } : {}),
            })
          );
        };

        const handleConnect = () => {
          recordWebsocketDebugEvent(provider, {
            kind: 'lifecycle',
            label: 'socket connect',
          });
        };

        const handleOpen = () => {
          recordWebsocketDebugEvent(provider, {
            kind: 'lifecycle',
            label: 'socket open',
          });
        };

        const handleAuthenticated = () => {
          setWorkspaceBlockingError(null);
          recordWebsocketDebugEvent(
            provider,
            {
              kind: 'auth',
              label: 'authenticated',
            },
            () => ({
              authenticated: true,
              lastError: null,
            })
          );
        };

        const handleAuthenticationFailed = (payload: { reason: string }) => {
          const blockingError =
            buildWorkspaceBlockingError(payload.reason) ?? {
              code: 'collab_permission_denied' as const,
              title: 'Workspace Access Denied',
              message:
                'The collaboration server denied access to this workspace. Editing has been blocked to prevent you from working in a broken session.',
              detail: payload.reason || null,
            };
          setWorkspaceBlockingError(blockingError);
          recordWebsocketDebugEvent(
            provider,
            {
              kind: 'error',
              label: 'authentication failed',
              detail: truncateWebsocketDebugText(payload.reason || 'unknown'),
            },
            () => ({
              authenticated: false,
              lastError: payload.reason || 'Authentication failed',
            })
          );
        };

        const handleSynced = (payload: { state: boolean }) => {
          recordWebsocketDebugEvent(
            provider,
            {
              kind: 'sync',
              label: payload.state ? 'synced' : 'unsynced',
            },
            () => ({
              synced: payload.state,
            })
          );
        };

        const handleIncomingMessage = (payload: { event: { data?: unknown } }) => {
          setWebsocketDebug((prev) => ({
            ...prev,
            documentName: provider.configuration.name,
            serverUrl: provider.configuration.websocketProvider.url,
            status: provider.status as WorkspaceWebsocketStatus,
            websocketReadyState:
              provider.configuration.websocketProvider.webSocket?.readyState ??
              prev.websocketReadyState,
            connected: provider.status === 'connected',
            authenticated: provider.isAuthenticated,
            synced: Boolean((provider as any).isSynced),
            unsyncedChanges: Number(provider.unsyncedChanges ?? 0),
            hasUnsyncedChanges: provider.hasUnsyncedChanges,
            awarenessUsers: provider.awareness
              ? Array.from(provider.awareness.getStates().values()).length
              : prev.awarenessUsers,
            lastMessageReceivedAt:
              typeof provider.configuration.websocketProvider.lastMessageReceived ===
                'number' &&
              provider.configuration.websocketProvider.lastMessageReceived > 0
                ? provider.configuration.websocketProvider.lastMessageReceived
                : prev.lastMessageReceivedAt,
            incomingMessages: prev.incomingMessages + 1,
            lastIncomingMessage: summarizeIncomingMessage(payload.event),
          }));
        };

        const handleOutgoingMessage = (payload: { message: unknown }) => {
          setWebsocketDebug((prev) => ({
            ...prev,
            documentName: provider.configuration.name,
            serverUrl: provider.configuration.websocketProvider.url,
            status: provider.status as WorkspaceWebsocketStatus,
            websocketReadyState:
              provider.configuration.websocketProvider.webSocket?.readyState ??
              prev.websocketReadyState,
            connected: provider.status === 'connected',
            authenticated: provider.isAuthenticated,
            synced: Boolean((provider as any).isSynced),
            unsyncedChanges: Number(provider.unsyncedChanges ?? 0),
            hasUnsyncedChanges: provider.hasUnsyncedChanges,
            awarenessUsers: provider.awareness
              ? Array.from(provider.awareness.getStates().values()).length
              : prev.awarenessUsers,
            lastMessageReceivedAt:
              typeof provider.configuration.websocketProvider.lastMessageReceived ===
                'number' &&
              provider.configuration.websocketProvider.lastMessageReceived > 0
                ? provider.configuration.websocketProvider.lastMessageReceived
                : prev.lastMessageReceivedAt,
            outgoingMessages: prev.outgoingMessages + 1,
            lastOutgoingMessage: summarizeOutgoingMessage(payload.message),
          }));
        };

        const handleStateless = (payload: { payload: string }) => {
          recordWebsocketDebugEvent(
            provider,
            {
              kind: 'stateless',
              label: 'stateless in',
              detail: summarizeStatelessPayload(payload.payload),
            },
            (prev) => ({
              statelessIncoming: prev.statelessIncoming + 1,
            })
          );
        };

        const handleClose = (payload: { event: { code?: number; reason?: string } }) => {
          const blockingError = buildWorkspaceBlockingError(
            payload.event?.reason ||
              (payload.event?.code === 4401
                ? 'Unauthorized'
                : payload.event?.code === 4403
                  ? 'Forbidden'
                  : '')
          );
          if (blockingError) {
            setWorkspaceBlockingError(blockingError);
          }
          recordWebsocketDebugEvent(
            provider,
            {
              kind: 'status',
              label: 'socket close',
              detail: summarizeWebsocketCloseEvent(payload.event),
            },
            () => ({
              connected: false,
            })
          );
        };

        const handleDisconnect = (payload: {
          event: { code?: number; reason?: string };
        }) => {
          const blockingError = buildWorkspaceBlockingError(
            payload.event?.reason ||
              (payload.event?.code === 4401
                ? 'Unauthorized'
                : payload.event?.code === 4403
                  ? 'Forbidden'
                  : '')
          );
          if (blockingError) {
            setWorkspaceBlockingError(blockingError);
          }
          recordWebsocketDebugEvent(
            provider,
            {
              kind: 'status',
              label: 'socket disconnect',
              detail: summarizeWebsocketCloseEvent(payload.event),
            },
            () => ({
              connected: false,
            })
          );
        };

        const handleAwarenessChange = (payload: { states: unknown[] }) => {
          recordWebsocketDebugEvent(
            provider,
            {
              kind: 'awareness',
              label: 'awareness change',
              detail: `${payload.states?.length ?? 0} peer(s)`,
            },
            () => ({
              awarenessUsers: payload.states?.length ?? 0,
            })
          );
        };

        const handleUnsyncedChanges = (count: number) => {
          syncWebsocketDebugSnapshot(provider, {
            unsyncedChanges: Number(count || 0),
            hasUnsyncedChanges: Number(count || 0) > 0,
          });
        };

        provider.sendStateless = (payload: string) => {
          recordWebsocketDebugEvent(
            provider,
            {
              kind: 'stateless',
              label: 'stateless out',
              detail: summarizeStatelessPayload(payload),
            },
            (prev) => ({
              statelessOutgoing: prev.statelessOutgoing + 1,
            })
          );
          originalSendStateless(payload);
        };

        provider.on("status", handleStatus);
        provider.on("connect", handleConnect);
        provider.on("open", handleOpen);
        provider.on("authenticated", handleAuthenticated);
        provider.on("authenticationFailed", handleAuthenticationFailed);
        provider.on("synced", handleSynced);
        provider.on("message", handleIncomingMessage);
        provider.on("outgoingMessage", handleOutgoingMessage);
        provider.on("stateless", handleStateless);
        provider.on("close", handleClose);
        provider.on("disconnect", handleDisconnect);
        provider.on("awarenessChange", handleAwarenessChange);
        provider.on("unsyncedChanges", handleUnsyncedChanges);

        detachDebugListeners = () => {
          provider.sendStateless = originalSendStateless;
          provider.off("status", handleStatus);
          provider.off("connect", handleConnect);
          provider.off("open", handleOpen);
          provider.off("authenticated", handleAuthenticated);
          provider.off("authenticationFailed", handleAuthenticationFailed);
          provider.off("synced", handleSynced);
          provider.off("message", handleIncomingMessage);
          provider.off("outgoingMessage", handleOutgoingMessage);
          provider.off("stateless", handleStateless);
          provider.off("close", handleClose);
          provider.off("disconnect", handleDisconnect);
          provider.off("awarenessChange", handleAwarenessChange);
          provider.off("unsyncedChanges", handleUnsyncedChanges);
        };

        recordWebsocketDebugEvent(
          provider,
          {
            kind: 'lifecycle',
            label: 'provider created',
            detail: collabUrl,
          },
          () => ({
            serverUrl: collabUrl,
            lastError: null,
          })
        );

        // Set initial awareness local state with user info
        try {
          const user = currentUserRef.current;
          if (user) {
            const aw = (provider as any).awareness as Awareness & { setLocalStateField?: (k: string, v: unknown) => void };
            const states = Array.from(aw.getStates().values()) as Array<{ user?: SessionUser }>;
            const taken = new Set(states.map(s => (s.user ? `${s.user.name}:${s.user.color}` : '')));
            const baseName = user.name;
            let uniqueName = baseName;
            let counter = 2;
            while (taken.has(`${uniqueName}:${user.color}`)) {
              uniqueName = `${baseName} ${counter}`;
              counter += 1;
            }
            aw.setLocalStateField?.("user", {
              id: user.id,
              name: uniqueName,
              color: user.color,
            });
            // Persist possibly suffixed name for this tab
            try { sessionStorage.setItem("display-name", uniqueName); } catch {}
          }
        } catch {}

        ydocRef.current = doc;
        providerRef.current = provider;
        syncWebsocketDebugSnapshot(provider);

        // Observe runtime and jobs maps and expose snapshots
        try {
          const runtime = doc.getMap('runtime') as Y.Map<any>
          const jobs = doc.getMap('jobs') as Y.Map<any>
          const syncRuntime = () => {
            const o: Record<string, any> = {}
            runtime.forEach((v: any, k: string) => { o[k] = v })
            setRuntimeSnap(o)
            // Live-sync workspace info and exercise when backend broadcasts updates
            try {
              const upd = (o['workspace:update'] as any) || (o['job:workspace:update'] as any) || null
              const val = upd && (upd.value ?? upd)
              const updAt = Number((upd && (upd.updatedAt ?? 0)) || 0)
              const isRelevant = Boolean(val && (val.workspaceType || val.workspaceSpec || val.exercise))
              const isNewer = updAt > (lastWorkspaceUpdateAtRef.current || 0)
              if (isRelevant && isNewer) {
                setWorkspaceInfo((prev) => {
                  const prevType = prev?.workspaceType
                  const prevSpec = prev?.workspaceSpec as any
                  const rawType = (val.workspaceType || prevType) as any
                  const nextType = (rawType === 'qa' || rawType === 'mcq') ? 'flashcard' : rawType
                  const nextSpec = (val.workspaceSpec !== undefined ? val.workspaceSpec : prevSpec) as any
                  return prev ? { ...prev, workspaceType: nextType, workspaceSpec: nextSpec } : (prev as any)
                })
                if (val.exercise) {
                  setExercise(val.exercise as any)
                }
                // Fire-and-forget: re-fetch exercise from API to ensure full freshness
                try {
                  const client = apiClient ?? (token ? new ApiClient(token) : null)
                  if (client) {
                    void client.getExercise().then((ex) => { setExercise(ex) }).catch(() => {})
                  }
                } catch {}
                // Show a transient indicator that the task changed (skip first load)
                if (hasSeenWorkspaceUpdateRef.current) {
                  setTaskJustChanged(true)
                  setTimeout(() => setTaskJustChanged(false), 10000)
                }
                hasSeenWorkspaceUpdateRef.current = true
                lastWorkspaceUpdateAtRef.current = updAt
              }
            } catch {}
          }
          const syncJobs = () => {
            const o: Record<string, any> = {}
            jobs.forEach((v: any, k: string) => { o[k] = v })
            setJobsSnap(o)
          }
          runtime.observe(syncRuntime); jobs.observe(syncJobs)
          syncRuntime(); syncJobs()
        } catch {}
      } catch (e) {
        console.error("Collaboration connection failed:", e);
        setIsConnected(false);
        const blockingError = buildWorkspaceBlockingError(
          e instanceof Error ? e.message : ''
        );
        if (blockingError) {
          setWorkspaceBlockingError(blockingError);
        }
        recordWebsocketDebugEvent(
          null,
          {
            kind: 'error',
            label: 'connection failed',
            detail:
              e instanceof Error
                ? truncateWebsocketDebugText(e.message)
                : 'Unknown websocket error',
          },
          () => ({
            status: 'disconnected',
            connected: false,
            lastError:
              e instanceof Error ? e.message : 'Unknown websocket error',
          })
        );
      }
    };

    connect();

    return () => {
      cancelled = true;
      detachDebugListeners?.();
      if (providerRef.current) {
        try {
          providerRef.current.destroy();
        } catch {}
        providerRef.current = null;
      }
      if (ydocRef.current) {
        try {
          ydocRef.current.destroy();
        } catch {}
        ydocRef.current = null;
      }
      setIsConnected(false);
    };
  }, [
    workspaceId,
    token,
    apiClient,
    recordWebsocketDebugEvent,
    syncWebsocketDebugSnapshot,
  ]);

  const updateWorkspaceContent = useCallback((content: string) => {
    // This is driven by the editor; we only mirror latest HTML for SSE and previews
    lastHtmlRef.current = content;
    setWorkspaceContent(content);
  }, []);

  const saveWorkspaceContent = useCallback(
    async (content: string, options?: { keepalive?: boolean }) => {
      const client = apiClient ?? (token ? new ApiClient(token) : null);
      if (!client || workspaceInfo?.workspaceType !== 'text') return;
      await client.saveWorkspaceState(content, options);
      lastPersistedContentRef.current = content;
    },
    [apiClient, token, workspaceInfo]
  );

  useEffect(() => {
    if (workspaceInfo?.workspaceType !== 'text' || !isInitialContentLoaded) return;
    if (workspaceContent === lastPersistedContentRef.current) return;

    if (contentSaveTimerRef.current) {
      clearTimeout(contentSaveTimerRef.current);
    }

    const pendingContent = workspaceContent;
    contentSaveTimerRef.current = setTimeout(() => {
      saveWorkspaceContent(pendingContent).catch((error) => {
        console.error('Failed to save workspace state:', error);
      });
    }, 500);

    return () => {
      if (contentSaveTimerRef.current) {
        clearTimeout(contentSaveTimerRef.current);
        contentSaveTimerRef.current = null;
      }
    };
  }, [isInitialContentLoaded, saveWorkspaceContent, workspaceContent, workspaceInfo]);

  useEffect(() => {
    if (workspaceInfo?.workspaceType !== 'text') return;

    const flush = () => {
      const pendingContent = lastHtmlRef.current;
      if (pendingContent === lastPersistedContentRef.current) return;
      void saveWorkspaceContent(pendingContent, { keepalive: true }).catch((error) => {
        console.error('Failed to flush workspace state:', error);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    };

    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveWorkspaceContent, workspaceInfo]);

  const refreshRateLimit = useCallback(async () => {
    const client = apiClient ?? (token ? new ApiClient(token) : null);
    if (!client) return;

    try {
      const type = workspaceInfo?.workspaceType || 'text';
      const kind = type === 'text' ? 'text.eval' : (type === 'code' ? 'code.run' : 'flashcard.validate');
      const rateLimitData = await client.getRateLimit(kind);
      setRateLimit(rateLimitData);
    } catch (error) {
      console.error("Failed to refresh rate limit:", error);
    }
  }, [apiClient, token, workspaceInfo]);

  useEffect(() => {
    if (!rateLimit) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    if (rateLimit.remaining === 0 && (rateLimit.resetSec ?? 0) > 0) {
      const ms = Math.max(0, Math.floor((rateLimit.resetSec ?? 0) * 1000 + 250));
      timer = setTimeout(() => {
        refreshRateLimit();
      }, ms);
    }

    return () => { if (timer) clearTimeout(timer); };
  }, [refreshRateLimit, rateLimit]);

  const { jobsActive, jobsRunning, activeJobStatus, latestJobText } = React.useMemo(() => {
    let anyActive = false;
    let anyRunning = false;
    let bestStatus: 'queued' | 'running' | null = null;
    let bestText = '';
    let bestTs = 0;
    let bestPriority = -1;

    try {
      Object.values(jobsSnap).forEach((job: any) => {
        const status =
          job?.status === 'queued' || job?.status === 'running'
            ? job.status
            : null;
        if (!status) return;

        anyActive = true;
        if (status === 'running') {
          anyRunning = true;
        }

        const ts = Number(
          job.updatedAt || job.startedAt || job.createdAt || 0
        );
        const priority = status === 'running' ? 2 : 1;
        const progressText =
          typeof job.progressText === 'string' && job.progressText.trim()
            ? job.progressText.trim()
            : typeof job.progress === 'number'
              ? `${job.progress}%`
              : status === 'queued'
                ? 'Queued…'
                : 'Processing…';

        if (
          priority > bestPriority ||
          (priority === bestPriority && ts >= bestTs)
        ) {
          bestPriority = priority;
          bestStatus = status;
          bestText = progressText;
          bestTs = ts;
        }
      });
    } catch {}

    return {
      jobsActive: anyActive,
      jobsRunning: anyRunning,
      activeJobStatus: bestStatus,
      latestJobText: bestText,
    };
  }, [jobsSnap]);

  const latestTextResult = React.useMemo(() => {
    try {
      if (workspaceInfo?.workspaceType !== 'text') return null;
      let best: LatestTextFeedbackCandidate | null = null;
      const considerFeedback = (payload: any) => {
        if (!payload) return;
        const ts = Number(payload.updatedAt || payload.finishedAt || 0);
        const val = (payload.value ?? (payload.payload ?? payload)) as any;
        if (val?.status === 'error' || val?.error || val?.message) {
          if (!best || ts >= best.ts) {
            best = {
              kind: 'error',
              ts,
              message: normalizeTextJobError(
                val?.message || val?.error || val?.summary
              ),
            };
          }
          return;
        }
        const hasFeedbackShape =
          typeof (val?.is_valid ?? val?.isValid) !== 'undefined' ||
          Array.isArray(val?.comments);
        if (!hasFeedbackShape) return;
        if (!best || ts >= best.ts) {
          best = { kind: 'feedback', ts, payload: val };
        }
      };
      const rf = (runtimeSnap as any)['text:feedback'];
      considerFeedback(rf);
      Object.keys(runtimeSnap || {}).forEach((k) => {
        if (k.startsWith('job:')) {
          const v = (runtimeSnap as any)[k]
          considerFeedback(v as any)
        }
      });
      Object.values(jobsSnap || {}).forEach((job: any) => {
        const kind = String(job?.kind || job?.type || '');
        if (kind && !['text.eval', 'evaluate', 'text_eval'].includes(kind)) return;
        if (job?.status !== 'error') return;
        const ts = Number(job?.updatedAt || job?.finishedAt || 0);
        if (!best || ts >= best.ts) {
          best = {
            kind: 'error',
            ts,
            message: normalizeTextJobError(
              job?.result?.message || job?.result?.summary || job?.error
            ),
          };
        }
      });
      const resolvedBest = best as LatestTextFeedbackCandidate | null;
      if (!resolvedBest) return null;
      if (resolvedBest.kind === 'error') {
        return {
          status: 'fail' as const,
          text: resolvedBest.message,
          updatedAt: resolvedBest.ts || Date.now(),
        };
      }
      const val = resolvedBest.payload;
      const isValid = Boolean(val?.is_valid ?? val?.isValid);
      const status: 'success' | 'fail' = isValid ? 'success' : 'fail';
      const text =
        typeof val?.summary === 'string' && val.summary.trim()
          ? val.summary.trim()
          : status === 'success'
            ? 'Great submission'
            : 'Some mistakes found';
      return {
        status,
        text,
        updatedAt: resolvedBest.ts || Date.now(),
      };
    } catch {
      return null;
    }
  }, [jobsSnap, runtimeSnap, workspaceInfo]);

  // Expose latest full feedback payload for text editor highlights
  const latestTextFeedback = React.useMemo(() => {
    try {
      if (workspaceInfo?.workspaceType !== 'text') return null;
      let best: any = null;
      let bestTs = 0;
      const consider = (payload: any) => {
        if (!payload) return;
        const ts = Number(payload.updatedAt || payload.finishedAt || 0);
        if (ts >= bestTs) { best = payload; bestTs = ts; }
      };
      const rf = (runtimeSnap as any)['text:feedback'];
      consider(rf);
      Object.entries(runtimeSnap || {}).forEach(([key, value]) => {
        if (key.startsWith('job:')) consider(value as any)
      });
      if (!best) return null;
      return (best.value ?? (best.payload ?? best)) as any;
    } catch {
      return null;
    }
  }, [runtimeSnap, workspaceInfo]);

  const latestTextFeedbackUpdatedAt = React.useMemo(() => {
    try {
      if (workspaceInfo?.workspaceType !== 'text') return null;
      let bestTs = 0;
      const consider = (payload: any) => {
        if (!payload) return;
        const ts = Number(payload.updatedAt || payload.finishedAt || 0);
        if (ts >= bestTs) { bestTs = ts; }
      };
      const rf = (runtimeSnap as any)['text:feedback'];
      consider(rf);
      return bestTs || null;
    } catch {
      return null;
    }
  }, [runtimeSnap, workspaceInfo]);

  // Local-only toggle to show/hide comments
  const [commentsVisible, setCommentsVisibleState] = useState<boolean>(() => {
    try {
      const key = `comments-visible:${workspaceId || ''}`;
      const v = typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null;
      return v === null ? true : v === '1';
    } catch { return true; }
  });
  const setCommentsVisible = useCallback((v: boolean) => {
    setCommentsVisibleState(v);
    try { const key = `comments-visible:${workspaceId || ''}`; window.sessionStorage.setItem(key, v ? '1' : '0'); } catch {}
  }, [workspaceId]);

  // Auto-show comments when new feedback arrives (per tab, no sync)
  const lastSeenFeedbackTsRef = useRef<number>(0);
  useEffect(() => {
    const ts = Number(latestTextFeedbackUpdatedAt || 0);
    if (ts > 0 && ts !== lastSeenFeedbackTsRef.current) {
      lastSeenFeedbackTsRef.current = ts;
      setCommentsVisible(true);
    }
  }, [latestTextFeedbackUpdatedAt, setCommentsVisible]);

  // After any job completes (done/error), refresh rate limit so UI reflects cooldown immediately across clients
  const seenCompletedJobsRef = useRef<Set<string>>(new Set());
  const lastRlRefreshAtRef = useRef<number>(0);


  //
  // Load user stats.
  //
  
  const refreshUserStats = useCallback(async () => {
  const client = apiClient ?? (token ? new ApiClient(token) : null);
  if (!client) return;
  try {
    const stats = await client.getUserStats();
    setUserStats(stats);
  } catch (err) {
    console.error("Failed to fetch user stats:", err);
  }
}, [apiClient, token]);

// Fetch once on init
useEffect(() => {
  if (!apiClient) return;
  refreshUserStats();
}, [apiClient, refreshUserStats]);

// Refresh certain things on job events
  useEffect(() => {
    let shouldRefresh = false;
    try {
      Object.entries(jobsSnap).forEach(([jobId, j]: [string, any]) => {
        const status = j?.status;
        if ((status === 'done' || status === 'error') && !seenCompletedJobsRef.current.has(jobId)) {
          seenCompletedJobsRef.current.add(jobId);
          shouldRefresh = true;
        }
      });
    } catch {}
    if (shouldRefresh) {
      const now = Date.now();
      if (now - lastRlRefreshAtRef.current > 1500) {
        lastRlRefreshAtRef.current = now;
        refreshRateLimit().catch(() => {});
        refreshUserStats().catch(() => {})
      }
    }
  }, [jobsSnap, refreshRateLimit, refreshUserStats]);

  return (
    <SessionContext.Provider
      value={{
        userStats,
        token,
        isConnected,
        exercise,
        workspaceContent,
        rateLimit,
        apiClient,
        isInitialContentLoaded,
        updateWorkspaceContent,
        refreshRateLimit,
        refreshUserStats,
        ydoc: ydocRef.current,
        provider: providerRef.current,
        awareness: (providerRef.current as any)?.awareness ?? null,
        currentUser: currentUserRef.current,
        workspaceInfo,
        jobsActive,
        jobsRunning,
        activeJobStatus,
        latestJobText,
        latestTextResult,
        latestTextFeedback,
        latestTextFeedbackUpdatedAt,
        commentsVisible,
        setCommentsVisible,
        taskJustChanged,
        websocketDebug,
        clearWebsocketDebugEvents,
        workspaceBlockingError,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
