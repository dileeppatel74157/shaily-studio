# Setup script for Windows PowerShell
Write-Host "Setting up Shaily Studio Dev Environment..." -ForegroundColor Cyan

# 1. Copy environment configuration
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created root .env from .env.example" -ForegroundColor Green
} else {
    Write-Host "Root .env already exists, skipping." -ForegroundColor Yellow
}

if (-not (Test-Path "apps/web/.env")) {
    Copy-Item ".env.example" "apps/web/.env"
    Write-Host "Created apps/web/.env from .env.example" -ForegroundColor Green
}

# 2. Install workspace dependencies
Write-Host "Installing workspace dependencies via pnpm..." -ForegroundColor Cyan
pnpm install

Write-Host "Setup complete! Run 'docker compose up --build' to start services." -ForegroundColor Green
