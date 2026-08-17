#!/usr/bin/env bash

set -euo pipefail

readonly IMAGE_URL="https://test.lingee.com/fileserver/s/VOL1hZEPqIPR.jpg"
readonly OUTPUT_PATH="${1:-VOL1hZEPqIPR.jpg}"
readonly TEMP_PATH="${OUTPUT_PATH}.part"

mkdir -p "$(dirname "$OUTPUT_PATH")"
trap 'rm -f "$TEMP_PATH"' EXIT

printf '正在下载：%s\n' "$IMAGE_URL"
curl \
  --fail \
  --location \
  --retry 3 \
  --retry-all-errors \
  --connect-timeout 15 \
  --output "$TEMP_PATH" \
  "$IMAGE_URL"

mv "$TEMP_PATH" "$OUTPUT_PATH"
trap - EXIT
printf '下载完成：%s\n' "$OUTPUT_PATH"
