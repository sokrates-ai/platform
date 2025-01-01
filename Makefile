.PHONY: setup check

DEPS:=poetry docker-compose python3

check:
	for pgm in $(DEPS); do \
		echo -e "Checking '$${pgm}'..."; \
		( which "$${pgm}" &> /dev/null ) || { echo "ERROR: Dependency: '$${pgm}' is missing, please install it."; exit 1; }; \
	done

docker-setup:
	docker-compose up -d

docker-nuke:
	docker-compose down
	docker-compose rm -f -v

PRODUCTION_DIR=PRODUCTION

mock-docker-build-web: ./apps/web/
	rm -rf $(PRODUCTION_DIR); mkdir -p $(PRODUCTION_DIR)
	cd ./apps/web/ && npm run build
	cp -r ./apps/web/ $(PRODUCTION_DIR)/
	cp -r ./apps/web/.next/standalone/* $(PRODUCTION_DIR)/web/
	cp -r ./apps/web/.next/static/ $(PRODUCTION_DIR)/web/.next/static

mock-docker-build-backend:

mock-docker-build: mock-docker-build-web mock-docker-build-backend
	cd ./apps/

mock-docker-run:
	cd $(PRODUCTION_DIR)/web && NODE_ENV=development node server.js &
	make api-run &
	caddy run --config /etc/caddy/Caddyfile 2> /dev/null

docker-build:
	docker build . -t sokrates-platform --progress=plain

api-setup:
	cd ./apps/api/ && poetry lock --no-update && poetry install

web-setup:
	cd ./apps/web/ && pnpm i

setup: check docker-setup api-setup web-setup

api-run: check
	cd ./apps/api/ && poetry run python3 app.py

web-run: check
	export NODE_ENV=development
	export NEXT_PUBLIC_LEARNHOUSE_API_URL=http://localhost:9000/api/v1/
	cd ./apps/web/ && pnpm run dev

all-run: api-run web-run
