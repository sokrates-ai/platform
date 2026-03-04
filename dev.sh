#!/usr/bin/env bash

DEPS=("poetry" "docker" "python3" "wget")

check() {
    echo "[SETUP]: Check"
    for pgm in "${DEPS[@]}"; do
        echo -e "Checking '${pgm}'..."
        (which "${pgm}" &>/dev/null) || {
            echo "[ERROR]: Dependency: '${pgm}' is missing, please install it."
            exit 1
        }
    done

    if ! docker ps &>/dev/null; then
        echo "[ERROR]: Docker is not configured properly."
        exit 1
    fi
}

load_dev_env() {
    if [ -f "./dev.env" ]; then
        set -a
        # shellcheck disable=SC1091
        . "./dev.env"
        set +a
    fi
}

api_setup() {
    echo "[SETUP]: API"
    bash -c 'cd ./apps/api/ && mkdir -p ./content && poetry lock && poetry install'
}

web_setup() {
    echo "[SETUP]: WEB"
    bash -c 'cd ./apps/web/ && pnpm i'
}

docker_setup() {
    echo "[SETUP]: Docker"
    (docker compose -f docker-compose-dev.yml up -d) || {
        echo "[ERROR]: Could not spin up development containers"
        exit 1
    }
}

docker_teardown() {
    check

    (docker compose -f docker-compose-dev.yml down -v) || {
        echo "[ERROR]: Could not tear down development containers"
        exit 1
    }
}

setup() {
    check

    web_setup
    api_setup
    docker_setup

    echo "[DONE]: Development environment ready"
}

reset() {
    docker_teardown
    docker_setup
}

#
# Development / Running.
#

print_env() {
    load_dev_env
    env
}


dev_web() {
    load_dev_env
    NODE_ENV=development \
        bash -c 'cd ./apps/web/ && pnpm run dev'
}

dev_backend() {
    load_dev_env
    env | rg PLATFORM
    env | rg REDIS
    bash -c 'cd ./apps/api/ && poetry run python3 app.py'
}

lint_web() {
    echo "=== WEB LINT ==="
    bash -c "cd ./apps/web && pnpm run lint"
}

lint_api() {
    echo "=== API LINT ==="
    bash -c "cd ./apps/api && poetry run ruff check"
}

lint() {
    lint_web || exit 1
    lint_api || exit 1
}

#
# Docker build.
#

docker-build() {
    OWNER="$1"
    TAG="$2"

    DOMAIN="ERROR"
    if [ "${TAG}" = "prod" ]; then
        DOMAIN="sokrates.ae.org"
    elif [ "${TAG}" = "staging" ]; then
        DOMAIN="staging.sokrates.ae.org"
    else
        echo "[ERROR]: Unknown TAG: ${TAG}"
        exit 1
    fi

    echo "Using DOMAIN: ${DOMAIN} for build..."

    docker build --build-arg DOMAIN=app.sokrates.ae.org --progress=plain -t "ghcr.io/${OWNER}/sk-platform-frontend:${TAG}" -f Dockerfile.web .
    docker build --progress=plain -t "ghcr.io/${OWNER}/sk-platform-backend:${TAG}" -f Dockerfile.api .

    docker push "ghcr.io/${OWNER}/sk-platform-frontend:${TAG}"
    docker push "ghcr.io/${OWNER}/sk-platform-backend:${TAG}"
}

#
# CLI
#

ARG="$1"

if [ "${ARG}" = "setup" ]; then
    setup
elif [ "${ARG}" = "env" ]; then
    print_env
elif [ "${ARG}" = "web-dev" ]; then
    dev_web
elif [ "${ARG}" = "api-dev" ]; then
    dev_backend
elif [ "${ARG}" = "reset" ]; then
    reset
elif [ "${ARG}" = "lint" ]; then
    lint
elif [ "${ARG}" = "docker" ]; then
    docker-build "$2" "$3"
elif [ "${ARG}" = "docker" ]; then
    docker-build "$2" "$3"
elif [ "${ARG}" = "db" ]; then
    docker compose -f docker-compose-dev.yml exec -it db psql --user learnhouse -d learnhouse
else
    echo -e "[ERROR]: Unknown argument <${ARG}>"
    exit 1
fi
