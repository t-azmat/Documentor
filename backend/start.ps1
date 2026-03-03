# Start Documentor Backend Server

Write-Host "Starting Documentor Backend..." -ForegroundColor Green

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    npm install
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env file from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "Please edit backend/.env with your configuration!" -ForegroundColor Red
    Write-Host "Press any key to continue after editing .env..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Start the server
Write-Host "Starting backend server on http://localhost:5000" -ForegroundColor Cyan
npm run dev
