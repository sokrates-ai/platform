FROM node:20-alpine

WORKDIR /srv

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# Install pyright and jsonrpc-ws-proxy
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN pnpm add -g pyright jsonrpc-ws-proxy

COPY servers.yml ./servers.yml

ENV LSP_PROXY_PORT=3011
EXPOSE 3011

CMD ["sh", "-lc", "node /root/.local/share/pnpm/global/5/node_modules/jsonrpc-ws-proxy/dist/server.js --port ${LSP_PROXY_PORT} --languageServers ./servers.yml"]
