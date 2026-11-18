#!/usr/bin/env bash
# Extrait d'une vidéo les effets utilisés par la landing page 3D :
#   frames/frame_NNNN.jpg  images couleur (lecture au défilement)
#   frames/depth_NNNN.jpg  cartes de relief (luminance inversée : sujet sombre devant le ciel clair)
#   frames/sky.json         couleur du ciel par image (haut de l'image)
#   frames/core.json        couleur du sujet par image (centre de l'image)
#   .tmp/contact.png        planche d'aperçu pour vérifier la palette
# Usage : tools/extract_video_effects.sh <vidéo> [fps=15] [sortie=frames]
set -euo pipefail
VIDEO="$1"; FPS="${2:-15}"; OUT="${3:-frames}"
mkdir -p "$OUT" .tmp
rm -f "$OUT"/frame_*.jpg "$OUT"/depth_*.jpg
ffmpeg -v error -y -i "$VIDEO" -vf "fps=$FPS" -q:v 3 "$OUT/frame_%04d.jpg"
ffmpeg -v error -y -i "$VIDEO" -vf "fps=$FPS,format=gray,negate,eq=contrast=1.15,gblur=sigma=9" -q:v 4 "$OUT/depth_%04d.jpg"
# Couleur du ciel : 25 % supérieurs de l'image, réduits à 1 pixel, flux RGB brut
ffmpeg -v error -y -i "$VIDEO" -vf "fps=$FPS,crop=iw:ih*0.25:0:0,scale=1:1:flags=area" -f rawvideo -pix_fmt rgb24 .tmp/sky.rgb
python3 "$(dirname "$0")/build_sky_json.py" .tmp/sky.rgb "$OUT/sky.json"
# Couleur du sujet : zone centrale (40 % x 45 %), saturation renforcée
ffmpeg -v error -y -i "$VIDEO" -vf "fps=$FPS,crop=iw*0.4:ih*0.45:iw*0.3:ih*0.35,eq=saturation=1.6,scale=1:1:flags=area" -f rawvideo -pix_fmt rgb24 .tmp/core.rgb
python3 "$(dirname "$0")/build_sky_json.py" .tmp/core.rgb "$OUT/core.json"
ffmpeg -v error -y -i "$VIDEO" -vf "fps=1,scale=240:-1,tile=8x2" -frames:v 1 .tmp/contact.png
echo "Images : $(ls "$OUT"/frame_*.jpg | wc -l | tr -d ' ')"
# Note : le FFmpeg Homebrew local n'a pas libwebp → sortie JPEG.
