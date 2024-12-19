for file in $(find . -type f \( -path "./apps/web/node_modules/*" -o -path "./apps/web/.next/*" \) -prune -o -path './apps/web/*' -print); do
    echo "Replacing '${file}'..."
    sed -i 's/(url) => swrFetcher/(url: string) => swrFetcher/g' "${file}"
done
