#!/bin/bash
# Build and push Docker image to registry
# Usage: ./build-and-push.sh [tag] [registry] [build_memory]
# Example: ./build-and-push.sh latest docker.io/username/hydra-facilitator 2048
#
# Arguments:
#   tag: Docker image tag (default: latest)
#   registry: Container registry URL (default: docker.io/hydraprotocol402/hydra-facilitator)
#   build_memory: Node.js heap size in MB for builds (default: 1024 minimum, use 2048 for CI/CD)

set -e

# Get script directory (should be examples/nestjs)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Default values
TAG="${1:-latest}"
REGISTRY="${2:-docker.io/hydraprotocol402/hydra-facilitator}"
BUILD_MEMORY="${3:-1024}"  # Default 1024MB (minimum for TypeScript DTS), override with 2048 for CI/CD
IMAGE="${REGISTRY}:${TAG}"

echo "Building Docker image: $IMAGE"
echo "From repository root: $REPO_ROOT"
echo "Dockerfile: $SCRIPT_DIR/Dockerfile"
echo "Build memory: ${BUILD_MEMORY}MB"
echo ""

# Build the image for linux/amd64 (required for most servers/Coolify)
cd "$REPO_ROOT"
docker buildx build \
  --platform linux/amd64 \
  --build-arg BUILD_MEMORY="${BUILD_MEMORY}" \
  -f "$SCRIPT_DIR/Dockerfile" \
  -t "$IMAGE" \
  --load \
  .

echo ""
echo "Build complete! Image: $IMAGE"
echo ""
echo "To push to registry:"
echo "  docker push $IMAGE"
echo ""
read -p "Push to registry now? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Pushing $IMAGE to registry (linux/amd64)..."
  docker buildx build \
    --platform linux/amd64 \
    --build-arg BUILD_MEMORY="${BUILD_MEMORY}" \
    -f "$SCRIPT_DIR/Dockerfile" \
    -t "$IMAGE" \
    --push \
    .
  echo ""
  echo "✅ Pushed $IMAGE to registry"
  echo ""
  echo "You can now configure Coolify to use this image:"
  echo "  Image: $IMAGE"
fi

