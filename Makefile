.PHONY: setup check sprites

env:
	./dev.sh env

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

lint:
	./dev.sh lint

db:
	./dev.sh db

sprites:
	cd ./apps/web/components/Dashboard/Pages/Course/EditCourseMap && bash build_sprite_index.sh

all-run: api-run web-run
