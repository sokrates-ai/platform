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

api_setup() {
    echo "[SETUP]: API"
    bash -c 'cd ./apps/api/ && poetry lock && poetry install'
}

web_setup() {
    echo "[SETUP]: WEB"
    bash -c 'cd ./apps/web/ && pnpm i'
}

docker_setup() {
    echo "[SETUP]: Docker"
    (docker compose -f docker-compose-dev.yml up db redis chromadb -d) || {
        echo "[ERROR]: Could not spin up development containers"
        exit 1
    }
}

teardown() {
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
    teardown
    setup
}

#
# Development / Running.
#

dev_web() {
    NODE_ENV=development \
        NEXT_PUBLIC_LEARNHOUSE_API_URL=http://localhost:1338/api/v1/ \
        NEXT_PUBLIC_LEARNHOUSE_BASE_URL=http://localhost:3000 \
        NEXT_PUBLIC_LEARNHOUSE_DEFAULT_ORG=default \
        NEXT_PUBLIC_LEARNHOUSE_MEDIA_URL=http://localhost:1338/ \
        NEXTAUTH_SECRET=changeme \
        bash -c 'cd ./apps/web/ && pnpm run dev'
}

dev_backend() {
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
        DOMAIN="app.sokrates.ae.org"
    elif [ "${TAG}" = "staging" ]; then
        DOMAIN="staging.sokrates.ae.org"
    else
        echo "[ERROR]: Unknown TAG: ${TAG}"
        exit 1
    fi

    echo "Using DOMAIN: ${DOMAIN} for build..."

    docker build --build-arg DOMAIN="${DOMAIN}" -t "ghcr.io/${OWNER}/sk-platform:${TAG}" .
    docker push "ghcr.io/${OWNER}/sk-platform:${TAG}"
}

#
# CLI
#

ARG="$1"

if [ "${ARG}" = "setup" ]; then
    setup
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
