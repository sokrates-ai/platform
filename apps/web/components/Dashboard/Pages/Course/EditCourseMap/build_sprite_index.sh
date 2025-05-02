#!/bin/bash
OUTPUT="spriteIndex.ts"

rm -f "${OUTPUT}"
echo "export const SPRITES = [" >> "${OUTPUT}"
for file in ../../../../../public/contentMap/*; do
    path=$(basename "${file}")
    label=$(echo "${path}" | sed -e "s/.webp//g")
    echo "  { scale: 1, file: '${path}', label: '${label}' }," >> "${OUTPUT}"
    echo "Added ${path}."
done
echo "]" >> "${OUTPUT}"
