Option Explicit
Dim sh, fso, bat, folder, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
' scripts\ -> raiz do repo
folder = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
bat = folder & "\totem-print-bridge.bat"
If Not fso.FileExists(bat) Then WScript.Quit 1
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = folder
' Sem pause: se a ponte cair, a janela nao fica travada pedindo tecla.
' 7 = minimizado, False = nao esperar (Chrome do kiosk abre na hora).
cmd = "cmd /c set TOTEM_BRIDGE_NO_PAUSE=1&& """ & bat & """"
sh.Run cmd, 7, False
