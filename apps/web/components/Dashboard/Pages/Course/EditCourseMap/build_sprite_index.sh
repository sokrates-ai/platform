#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT="${SCRIPT_DIR}/spriteIndex.ts"
CONTENT_DIR="${SCRIPT_DIR}/../../../../../public/contentMap"
CONFIG_FILE="${SCRIPT_DIR}/sprite_scaling.json"

HAS_CONFIG=false
if [ -f "${CONFIG_FILE}" ]; then
    HAS_CONFIG=true
    if ! command -v jq >/dev/null 2>&1; then
        echo "Error: jq is required to process ${CONFIG_FILE}." >&2
        exit 1
    fi
    if ! jq empty "${CONFIG_FILE}" >/dev/null 2>&1; then
        echo "Error: ${CONFIG_FILE} contains invalid JSON." >&2
        exit 1
    fi
fi

if [ ! -d "${CONTENT_DIR}" ]; then
    echo "Error: Content directory not found: ${CONTENT_DIR}" >&2
    exit 1
fi

rm -f "${OUTPUT}"
printf "export const SPRITES = [\n" >> "${OUTPUT}"

for file in "${CONTENT_DIR}"/*; do
    path=$(basename "${file}")
    label="${path%.*}"

    scale="1"

    if [ "${HAS_CONFIG}" = true ]; then
        scale=$(jq -r --arg file "${path}" '
            if has($file) then
                .[$file] | if type == "number" then . elif type == "object" then (.scale // 1) else 1 end
            else
                1
            end' "${CONFIG_FILE}") || scale="1"

        if [ -z "${scale}" ] || [ "${scale}" = "null" ]; then
            scale="1"
        fi
    fi

    escaped_path=$(printf "%s" "${path}" | sed "s/'/\\\\\\'/g")
    escaped_label=$(printf "%s" "${label}" | sed "s/'/\\\\\\'/g")

    printf "  { scale: %s, file: '%s', label: '%s' },\n" "${scale}" "${escaped_path}" "${escaped_label}" >> "${OUTPUT}"

    echo "Added ${path}."
done

printf "]\n" >> "${OUTPUT}"
