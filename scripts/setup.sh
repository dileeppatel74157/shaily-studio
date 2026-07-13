#!/bin/bash
set -e

echo "Setting up Shaily Studio Dev Environment..."

# 1. Copy environment files
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created root .env"
fi

if [ ! -f apps/web/.env ]; then
  cp .env.example apps/web/.env
  echo "Created apps/web/.env"
fi

# 2. Install workspace dependencies
echo "Installing dependencies..."
pnpm install

echo "Setup complete! Run 'docker compose up --build' to start services."
