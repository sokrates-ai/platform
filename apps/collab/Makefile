SHELL := /usr/bin/env bash

# Load centralized env (later ones override earlier ones)
ENV_FILES := $(HOME)/.config/sokrates/.env ../../.env ../.env .env .env.local ../env-variables.txt
-include $(ENV_FILES)
export

PKG_MANAGER := pnpm

.PHONY: collab-setup collab-run collab-clean collab-lint

collab-setup:
	@$(PKG_MANAGER) install

collab-run:
	@test -n "$$COLLAB_WS_PORT" || (echo "COLLAB_WS_PORT is required" && exit 1)
	@test -n "$$COLLAB_BRIDGE_PORT" || (echo "COLLAB_BRIDGE_PORT is required" && exit 1)
	@test -n "$$COLLAB_BIND_ADDRESS" || (echo "COLLAB_BIND_ADDRESS is required" && exit 1)
	@test -n "$$COLLAB_INSTANCE_NAME" || (echo "COLLAB_INSTANCE_NAME is required" && exit 1)
	@test -n "$$SHARED_COLLAB_JWT_SECRET" || (echo "SHARED_COLLAB_JWT_SECRET is required" && exit 1)
	@test -n "$$COLLAB_REDIS_HOST" || (echo "COLLAB_REDIS_HOST is required" && exit 1)
	@test -n "$$COLLAB_REDIS_PORT" || (echo "COLLAB_REDIS_PORT is required" && exit 1)
	@test -n "$$COLLAB_API_BASE_URL" || (echo "COLLAB_API_BASE_URL is required" && exit 1)
	@$(PKG_MANAGER) run start

collab-lint:
	@echo "No lint configured for collab yet."

collab-clean:
	@rm -rf node_modules 
