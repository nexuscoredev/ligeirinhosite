#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Bloqueia gestos de borda, atalhos do Windows e reforça o modo quiosque no PC do totem.

.DESCRIPTION
    Execute UMA VEZ como Administrador no PC do totem (Surface/tablet Windows).
    Complementa totem-kiosk.bat e js/totem-kiosk-guard.js.

    Depois de aplicar: reinicie o PC ou execute "Stop-Process -Name explorer -Force; Start-Process explorer".

.NOTES
    Windows 11 23H2+: desativa Left_Edgy_Enabled / Right_Edgy_Enabled (gesto da borda esquerda = Task View).
    Alt+Tab e Win+Tab podem exigir "Acesso Atribuído" (Assigned Access) no Windows Pro/Enterprise.
#>
$ErrorActionPreference = 'Stop'

Write-Host 'Ligeirinho Totem — bloqueio do Windows' -ForegroundColor Cyan
Write-Host ''

function Set-DwordReg($Path, $Name, $Value) {
    if (-not (Test-Path $Path)) {
        New-Item -Path $Path -Force | Out-Null
    }
    Set-ItemProperty -Path $Path -Name $Name -Value $Value -Type DWord -Force
}

# Gestos de borda legado (Task View, Action Center, etc.)
Set-DwordReg 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\EdgeUI' 'AllowEdgeSwipe' 0
Set-DwordReg 'HKLM:\SOFTWARE\Microsoft\PolicyManager\default\LockDown\AllowEdgeSwipe' 'value' 0
Set-DwordReg 'HKCU:\SOFTWARE\Policies\Microsoft\Windows\EdgeUI' 'AllowEdgeSwipe' 0

# Windows 11 23H2+ — gestos por borda (Wisp/Touch)
Set-DwordReg 'HKCU:\Software\Microsoft\Wisp\Touch' 'Left_Edgy_Enabled' 0
Set-DwordReg 'HKCU:\Software\Microsoft\Wisp\Touch' 'Right_Edgy_Enabled' 0
Set-DwordReg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Touch' 'EnableC2DEdgyGesture' 0

# Tecla Windows e atalhos do Explorer (Win+R, Win+E, etc.)
Set-DwordReg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer' 'NoWinKeys' 1

# Gerenciador de tarefas (Ctrl+Shift+Esc) para o usuário do totem
Set-DwordReg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System' 'DisableTaskMgr' 1

# Desabilitar botão Task View na barra (quando existir)
if (-not (Test-Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced')) {
    New-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' -Force | Out-Null
}
Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' -Name 'ShowTaskViewButton' -Value 0 -Type DWord -Force

Write-Host '[OK] Registro aplicado.' -ForegroundColor Green
Write-Host ''
Write-Host 'Windows 11 (23H2+): confira tambem em Configuracoes' -ForegroundColor Yellow
Write-Host '  Bluetooth e dispositivos > Tela sensivel ao toque'
Write-Host '  Desative gestos da borda esquerda e direita.'
Write-Host ''
Write-Host 'Para bloqueio maximo: use Acesso Atribuido com Chrome como app unico.'
Write-Host '  Configuracoes > Contas > Outros usuarios > Configuracao de quiosque'
Write-Host ''
Write-Host 'Reinicie o Explorer ou o PC para aplicar.' -ForegroundColor Yellow

$restart = Read-Host 'Reiniciar Explorer agora? (S/N)'
if ($restart -match '^[sS]') {
    Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Start-Process explorer
    Write-Host 'Explorer reiniciado.' -ForegroundColor Green
}
