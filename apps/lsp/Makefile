SHELL := /bin/bash

.PHONY: lsp-setup lsp-run lsp-clean

lsp-setup:
	@echo "Building lsp image..."
	@docker build -t sk-lsp:local .

lsp-run:
	@if [ -z "$$LSP_PROXY_PORT" ]; then \
	  if [ "$$LSP_LOCAL" = "1" ]; then export LSP_PROXY_PORT=3011; else echo "LSP_PROXY_PORT is required" && exit 1; fi; \
	fi; \
	if [ "$$LSP_LOCAL" = "1" ]; then \
	  echo "Starting local jsonrpc-ws-proxy on port $$LSP_PROXY_PORT"; \
	  pnpm dlx jsonrpc-ws-proxy --port $$LSP_PROXY_PORT --languageServers ./servers.yml; \
	else \
	  docker run --rm \
	    -e RUST_LOG=info \
	    -e LSP_PROXY_PORT=$$LSP_PROXY_PORT \
	    -e LSP_MAX_CONN=$${LSP_MAX_CONN} \
	    -p $$LSP_PROXY_PORT:$$LSP_PROXY_PORT \
	    --name sk-lsp sk-lsp:local; \
	fi

lsp-clean:
	docker rmi sk-lsp:local || true 