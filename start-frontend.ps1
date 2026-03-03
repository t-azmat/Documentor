# Start Documentor Frontend

Write-Host "Starting Documentor Frontend..." -ForegroundColor Green

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    npm install
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env file from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

# Start the dev server
Write-Host "Starting frontend on http://localhost:3000" -ForegroundColor Cyan
npm run dev
