# Ponte de impressão silenciosa do totem (Windows).
# Uso USB:  .\scripts\start-totem-print-bridge.ps1 -PrinterName "ELGIN i9"
# Uso rede:  .\scripts\start-totem-print-bridge.ps1 -PrinterHost "192.168.0.50"
# Listar:    .\scripts\start-totem-print-bridge.ps1 -ListPrinters

param(
    [string]$PrinterName = $env:TOTEM_PRINTER_NAME,
    [string]$PrinterHost = $env:TOTEM_PRINTER_HOST,
    [int]$PrinterPort = $(if ($env:TOTEM_PRINTER_PORT) { [int]$env:TOTEM_PRINTER_PORT } else { 9100 }),
    [int]$BridgePort = $(if ($env:TOTEM_BRIDGE_PORT) { [int]$env:TOTEM_BRIDGE_PORT } else { 8787 }),
    [string]$BridgeHost = $(if ($env:TOTEM_BRIDGE_HOST) { $env:TOTEM_BRIDGE_HOST } else { '0.0.0.0' }),
    [switch]$ListPrinters,
    [switch]$LocalOnly
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "[totem] Node.js nao encontrado no PATH. Instale em https://nodejs.org" -ForegroundColor Red
    Read-Host "Enter para sair"
    exit 1
}

if ($LocalOnly) {
    $BridgeHost = '127.0.0.1'
}

if ($ListPrinters) {
    Write-Host "`nImpressoras instaladas no Windows:`n" -ForegroundColor Cyan
    Get-Printer | Select-Object -ExpandProperty Name | ForEach-Object { Write-Host "  $_" }
    Write-Host "`nUse: .\scripts\start-totem-print-bridge.ps1 -PrinterName `"NOME EXATO`"`n"
    exit 0
}

if (-not $PrinterName -and -not $PrinterHost) {
    $defaultPrinter = Get-CimInstance -ClassName Win32_Printer -Filter "Default='True'" -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty Name
    if ($defaultPrinter) {
        $PrinterName = $defaultPrinter
        Write-Host "[totem] Impressora padrao do Windows: $PrinterName" -ForegroundColor Green
    } else {
        Write-Host "Defina a impressora USB ou o IP de rede." -ForegroundColor Yellow
        Write-Host "  USB:  -PrinterName `"ELGIN i9`""
        Write-Host "  Rede: -PrinterHost `"192.168.0.50`""
        Write-Host "  Lista: -ListPrinters`n"
        $PrinterName = 'ELGIN i9'
        Write-Host "Tentando padrao USB: $PrinterName`n" -ForegroundColor DarkYellow
    }
}

$env:TOTEM_BRIDGE_HOST = $BridgeHost
$env:TOTEM_BRIDGE_PORT = [string]$BridgePort

if ($PrinterHost) {
    $env:TOTEM_PRINTER_HOST = $PrinterHost
    $env:TOTEM_PRINTER_PORT = [string]$PrinterPort
    Remove-Item Env:TOTEM_PRINTER_NAME -ErrorAction SilentlyContinue
    Write-Host "[totem] Rede: ${PrinterHost}:${PrinterPort}" -ForegroundColor Green
} else {
    $env:TOTEM_PRINTER_NAME = $PrinterName
    Remove-Item Env:TOTEM_PRINTER_HOST -ErrorAction SilentlyContinue
    Write-Host "[totem] USB Windows: $PrinterName" -ForegroundColor Green
}

$lanIp = (
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -First 1 -ExpandProperty IPAddress
)

Write-Host "[totem] Ponte: http://${BridgeHost}:${BridgePort}/print" -ForegroundColor Cyan
if ($lanIp) {
    Write-Host "[totem] Tablet na mesma Wi-Fi: http://${lanIp}:${BridgePort}/print" -ForegroundColor Cyan
}
Write-Host "[totem] Teste: http://127.0.0.1:${BridgePort}/health`n" -ForegroundColor DarkGray

& node (Join-Path $repoRoot 'scripts\totem-print-bridge.mjs')
