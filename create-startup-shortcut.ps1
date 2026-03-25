$WshShell = New-Object -ComObject WScript.Shell
$StartupPath = [System.IO.Path]::Combine($env:APPDATA, 'Microsoft\Windows\Start Menu\Programs\Startup\EsqueletoDevServer.lnk')
$Shortcut = $WshShell.CreateShortcut($StartupPath)
$Shortcut.TargetPath = 'C:\Users\joseh\Antigravity\Esqueleto\start-dev-server.bat'
$Shortcut.WorkingDirectory = 'C:\Users\joseh\Antigravity\Esqueleto'
$Shortcut.WindowStyle = 7
$Shortcut.Description = 'Esqueleto Dev Server AutoStart'
$Shortcut.Save()
Write-Host 'Shortcut created successfully in Startup folder!'
