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

set_version() {
    local version_file="./apps/web/package.json"
    local new_version="$1"
    local current_version

    if [ ! -f "${version_file}" ]; then
        echo "[ERROR]: Could not find ${version_file}"
        exit 1
    fi

    current_version="$(python3 - "${version_file}" <<'PY'
import json
import sys
from pathlib import Path

version_file = Path(sys.argv[1])
try:
    data = json.loads(version_file.read_text())
    print(data.get("version", "unknown"))
except Exception:
    print("unknown")
PY
)"

    echo "[INFO]: Current version is ${current_version}"

    if [ -z "${new_version}" ]; then
        printf "Enter new version: "
        IFS= read -r new_version
    fi

    if [ -z "${new_version}" ]; then
        echo "[ERROR]: Version cannot be empty"
        exit 1
    fi

    if [[ "${new_version}" == v* ]]; then
        new_version="${new_version#v}"
    fi

    if [[ ! "${new_version}" =~ ^[0-9]+(\.[0-9]+){2}([\-+][0-9A-Za-z.-]+)?$ ]]; then
        echo "[ERROR]: Invalid version. Expected semver like 1.2.3 or 1.2.3-alpha.1"
        exit 1
    fi

    python3 - "${version_file}" "${new_version}" <<'PY'
import json
import sys
from pathlib import Path

version_file = Path(sys.argv[1])
new_version = sys.argv[2]

data = json.loads(version_file.read_text())
data["version"] = new_version
version_file.write_text(json.dumps(data, indent=2) + "\n")
print(f"[DONE]: Updated {version_file} to {new_version}")
PY
}

#
# Docker build.
#

dfail() {
    echo "ERROR: Docker build was not successful!"
    exit 1
}

docker-build() {
    OWNER="$1"
    TAG="$2"

    DOMAIN="ERROR"
    if [ "${TAG}" = "prod" ]; then
        DOMAIN="sokrates-hpi.de"
    elif [ "${TAG}" = "staging" ]; then
        DOMAIN="staging.sokrates-hpi.de"
    else
        echo "[ERROR]: Unknown TAG: ${TAG}"
        dfail
    fi

    echo "======================================"
    echo "Using DOMAIN: <${DOMAIN}> for build..."
    echo "======================================"

    docker build --build-arg DOMAIN="${DOMAIN}" --progress=plain -t "ghcr.io/${OWNER}/sk-platform-frontend:${TAG}" -f Dockerfile.web . || dfail
    docker build --progress=plain -t "ghcr.io/${OWNER}/sk-platform-backend:${TAG}" -f Dockerfile.api . || dfail

    docker push "ghcr.io/${OWNER}/sk-platform-frontend:${TAG}" || dfail
    docker push "ghcr.io/${OWNER}/sk-platform-backend:${TAG}" || dfail
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
elif [ "${ARG}" = "set-version" ]; then
    set_version "$2"
elif [ "${ARG}" = "docker" ]; then
    docker-build "$2" "$3"
elif [ "${ARG}" = "db" ]; then
    docker compose -f docker-compose-dev.yml exec -it db psql --user learnhouse -d learnhouse
else
    echo -e "[ERROR]: Unknown argument <${ARG}>"
    exit 1
fi
