#Requires -Version 5.1
<#
.SYNOPSIS
    Configura o PC do totem: gestos de borda (Windows 11) + iniciar sempre pelo totem-kiosk.bat

.DESCRIPTION
    Execute no PC do totem (duplo clique em totem-configurar-pc.bat na raiz do repo).
    - Aplica bloqueio de gestos de borda no registro (usuario atual)
    - Abre Configuracoes > Tela sensivel ao toque (desative bordas esquerda/direita)
    - Cria atalho na Inicializacao do Windows (totem-kiosk.bat ao ligar o PC)
    - Cria atalho na Area de trabalho

    Para bloqueio completo (HKLM), execute como Admin:
      powershell -ExecutionPolicy Bypass -File scripts\totem-windows-lockdown.ps1
#>
$ErrorActionPreference = 'Stop'

function Write-Step($msg) {
    Write-Host "`n>> $msg" -ForegroundColor Cyan
}

function Set-DwordReg($Path, $Name, $Value) {
    if (-not (Test-Path $Path)) {
        New-Item -Path $Path -Force | Out-Null
    }
    Set-ItemProperty -Path $Path -Name $Name -Value $Value -Type DWord -Force
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$kioskBat = Join-Path $repoRoot 'totem-kiosk.bat'

if (-not (Test-Path $kioskBat)) {
    Write-Host "Nao encontrei totem-kiosk.bat em: $kioskBat" -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Yellow
Write-Host ' Ligeirinho Totem — configuracao do PC' -ForegroundColor Yellow
Write-Host '========================================' -ForegroundColor Yellow

Write-Step '1/4 — Bloqueio de gestos de borda (registro, usuario atual)'
try {
    Set-DwordReg 'HKCU:\Software\Microsoft\Wisp\Touch' 'Left_Edgy_Enabled' 0
    Set-DwordReg 'HKCU:\Software\Microsoft\Wisp\Touch' 'Right_Edgy_Enabled' 0
    Set-DwordReg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Touch' 'EnableC2DEdgyGesture' 0
    Set-DwordReg 'HKCU:\SOFTWARE\Policies\Microsoft\Windows\EdgeUI' 'AllowEdgeSwipe' 0
    Write-Host '   [OK] Chaves de gesto de borda aplicadas para o usuario atual.' -ForegroundColor Green
} catch {
    Write-Host "   [AVISO] Registro parcial: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Step '2/4 — Abrir Configuracoes do Windows (gestos de toque)'
Write-Host @'
   Na tela que vai abrir:
   • Bluetooth e dispositivos > Tela sensivel ao toque
   • DESATIVE gestos da borda ESQUERDA e DIREITA
   • Salve / feche as configuracoes
'@ -ForegroundColor Gray

Start-Sleep -Seconds 2
try {
    Start-Process 'ms-settings:devices-touch'
} catch {
    try {
        Start-Process 'ms-settings:bluetooth'
        Write-Host '   Abriu Bluetooth e dispositivos — entre em Tela sensivel ao toque.' -ForegroundColor Yellow
    } catch {
        Write-Host '   Abra manualmente: Configuracoes > Bluetooth e dispositivos > Tela sensivel ao toque' -ForegroundColor Yellow
    }
}

Write-Step '3/4 — Atalho na Inicializacao do Windows (sempre totem-kiosk.bat)'
$startup = [Environment]::GetFolderPath('Startup')
$desktop = [Environment]::GetFolderPath('Desktop')
$wsh = New-Object -ComObject WScript.Shell

$startupLink = Join-Path $startup 'Ligeirinho Totem.lnk'
$desktopLink = Join-Path $desktop 'Ligeirinho Totem.lnk'

foreach ($pair in @(
        @{ Path = $startupLink; Label = 'Inicializacao' },
        @{ Path = $desktopLink; Label = 'Area de trabalho' }
    )) {
    $sc = $wsh.CreateShortcut($pair.Path)
    $sc.TargetPath = $kioskBat
    $sc.WorkingDirectory = $repoRoot
    $sc.WindowStyle = 1
    $sc.Description = 'Ligeirinho Totem — modo quiosque'
    $sc.IconLocation = "$env:SystemRoot\System32\imageres.dll,109"
    $sc.Save()
    Write-Host "   [OK] Atalho criado: $($pair.Label)" -ForegroundColor Green
    Write-Host "        $($pair.Path)" -ForegroundColor DarkGray
}

Write-Step '4/4 — Encerrar Chrome comum (use so o atalho Ligeirinho Totem)'
$closeChrome = Read-Host '   Fechar janelas do Chrome abertas agora? (S/N)'
if ($closeChrome -match '^[sS]') {
    Get-Process -Name chrome -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host '   [OK] Chrome encerrado. Inicie pelo atalho Ligeirinho Totem.' -ForegroundColor Green
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host ' Configuracao concluida' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host @'

Proximos passos:
  1. Desative os gestos de borda na tela de Configuracoes (passo 2)
  2. Reinicie o PC OU faca logoff/logon
  3. Ao ligar, o totem abrira sozinho pelo totem-kiosk.bat
  4. Nao abra o Chrome manualmente — use sempre o atalho "Ligeirinho Totem"

Opcional (Admin, uma vez): bloqueio maximo do Windows
  powershell -ExecutionPolicy Bypass -File scripts\totem-windows-lockdown.ps1

'@ -ForegroundColor White

$launch = Read-Host 'Abrir o totem agora pelo totem-kiosk.bat? (S/N)'
if ($launch -match '^[sS]') {
    Start-Process -FilePath $kioskBat -WorkingDirectory $repoRoot
}
