#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: ./scripts/set-home-hero-background.sh /path/to/image.png" >&2
  exit 1
fi

source_input=$1

if [ ! -f "$source_input" ]; then
  echo "Source image not found: $source_input" >&2
  exit 1
fi

source_dir=$(CDPATH= cd -- "$(dirname -- "$source_input")" && pwd -P)
source_file=$(basename -- "$source_input")
source="$source_dir/$source_file"

case "$source_file" in
  *.*) extension=$(printf '%s' "${source_file##*.}" | tr '[:upper:]' '[:lower:]') ;;
  *) extension="" ;;
esac

case "$extension" in
  png|jpg|jpeg|webp) ;;
  *)
    echo "Unsupported image type '.$extension'. Use PNG, JPG, JPEG, or WEBP." >&2
    exit 1
    ;;
esac

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd -P)
target_dir="$repo_root/web/public/images/home"
target="$target_dir/hero-background.png"

mkdir -p "$target_dir"

if [ "$source" != "$target" ]; then
  cp "$source" "$target"
fi

echo "Updated home hero background:"
echo "$target"
