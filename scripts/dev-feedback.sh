#!/bin/bash
# Development feedback loop
# Run this script to build, test, and generate previews

set -e

echo "🔨 Building..."
yarn build

echo ""
echo "🧪 Running tests..."
yarn test run

echo ""
echo "🎨 Generating previews..."
yarn tsx scripts/generate-previews.ts

echo ""
echo "✅ Done! Open test-output/index.html to see the previews"
