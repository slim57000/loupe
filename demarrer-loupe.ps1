$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$dockerDesktop = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'

if (-not (Test-Path -LiteralPath (Join-Path $root '.env'))) {
    Copy-Item -LiteralPath (Join-Path $root '.env.example') -Destination (Join-Path $root '.env')
    Write-Host 'Fichier .env créé depuis .env.example.'
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    throw 'Docker CLI est introuvable. Installez Docker Desktop puis relancez ce script.'
}

$running = $false
try {
    docker info *> $null
    $running = $LASTEXITCODE -eq 0
} catch {
    $running = $false
}

if (-not $running) {
    if (-not (Test-Path -LiteralPath $dockerDesktop)) {
        throw 'Docker Desktop est introuvable. Lancez Docker Desktop puis relancez ce script.'
    }
    Write-Host 'Démarrage de Docker Desktop…'
    Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        Start-Sleep -Seconds 3
        docker info *> $null
        if ($LASTEXITCODE -eq 0) {
            $running = $true
            break
        }
    }
}

if (-not $running) {
    throw 'Docker Desktop n’est pas prêt. Vérifiez sa fenêtre puis relancez ce script.'
}

Write-Host 'Construction et démarrage de Loupe…'
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
    throw 'Le démarrage de Loupe a échoué.'
}

Start-Process 'http://localhost:3000'
Write-Host 'Loupe est accessible sur http://localhost:3000'
