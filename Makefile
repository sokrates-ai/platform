.PHONY: setup check


docker-nuke:
	docker compose down
	docker compose rm -f -v

setup:
	./dev.sh setup

reset:
	./dev.sh reset

web-dev:
	./dev.sh web-dev

api-dev:
	./dev.sh api-dev

all-run: api-run web-run
