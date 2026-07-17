Option Explicit
Dim sh, fso, bat, folder
Set fso = CreateObject("Scripting.FileSystemObject")
 ' scripts\ -> raiz do repo
folder = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
bat = folder & "\totem-print-bridge.bat"
If Not fso.FileExists(bat) Then WScript.Quit 1
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = folder
 ' 7 = minimizado, False = nao esperar
sh.Run """" & bat & """", 7, False
