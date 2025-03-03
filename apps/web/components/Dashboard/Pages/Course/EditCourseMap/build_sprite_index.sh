OUTPUT="spriteIndex.ts"

rm -f "${OUTPUT}"

# counter=0
# for file in ../../../../../public/content_map/*; do
#     path=$(basename "${file}")
#     echo "import SPRITE_${counter} from 'public/content_map/${path}';" >> "${OUTPUT}"
#     ((counter+=1))
# done
#
# echo "" >> "${OUTPUT}"

# counter=0
echo "export const SPRITES = [" >> "${OUTPUT}"
for file in ../../../../../public/content_map/*; do
    path=$(basename "${file}")
    label=$(echo "${path}" | sed -e "s/.webp//g")
    echo "  { scale: 1, file: '${path}', label: '${label}' }," >> "${OUTPUT}"
    # ((counter+=1))
done
echo "]" >> "${OUTPUT}"
