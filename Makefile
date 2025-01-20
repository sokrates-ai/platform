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
	NODE_ENV=development NEXT_PUBLIC_LEARNHOUSE_API_URL=http://localhost:1338/api/v1/ NEXT_PUBLIC_LEARNHOUSE_BASE_URL=http://localhost:3000 bash -c 'cd ./apps/web/ && pnpm run dev'

all-run: api-run web-run
