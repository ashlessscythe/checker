#!/bin/bash
# sync_main.sh

# Ensure you're on the dev branch
git checkout dev

# Optional: Create a tag
read -p "Enter tag name (leave blank to skip): " TAG
if [ ! -z "$TAG" ]; then
  git tag -a "$TAG" -m "Release $TAG"
  git push --tags
fi

# Sync main to dev
git checkout main
git reset --hard dev
git push --force
git checkout dev

echo "Public branch synced with dev successfully!"