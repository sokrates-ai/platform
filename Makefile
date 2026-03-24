.PHONY: setup check sprites staging prod

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

docker-prod:
	bash ./dev.sh docker sokrates-ai prod
	
docker-staging:
	bash ./dev.sh docker sokrates-ai staging

staging:
	git checkout staging
	git merge dev
	git push origin staging
	git checkout dev

prod:
	git checkout prod
	git merge staging
	git push origin prod
	git checkout dev

db:
	./dev.sh db

sprites:
	cd ./apps/web/components/Dashboard/Pages/Course/EditCourseMap && bash build_sprite_index.sh

all-run: api-run web-run
