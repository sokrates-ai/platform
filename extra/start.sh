#!/bin/sh

#
# NOTE: https://github.com/sokrates-ai/sokrates/issues/170
# Environment variable aggregator.
#
URL="${SK_PUBLIC_URL}"

if [ "${URL}" = "" ]; then
    echo "Environment variable 'SK_PUBLIC_URL' is undefined."
    exit 1
fi

echo "Using Sokrates public URL (SK_PUBLIC_URL): '${URL}'"
export NEXTAUTH_URL="${URL}"
export NEXT_PUBLIC_LEARNHOUSE_BASE_URL="${URL}"

#
# Start the service
#
cd /app/web || exit 1
exec node server.js
