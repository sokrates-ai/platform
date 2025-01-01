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
# Start the services
#
pm2 start server.js --cwd /app/web --name learnhouse-web >/dev/null 2>&1
pm2 start app.py --cwd /app/api --name learnhouse-api >/dev/null 2>&1

# Check if the services are running qnd log the status.
pm2 status

# Start Caddy in the background.
caddy run --config /etc/caddy/Caddyfile 2>/dev/null &
echo "Started caddy..."

# Tail Nginx error and access logs.
pm2 logs
