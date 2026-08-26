Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\mam07\.gemini\antigravity\brain\ebea6b65-346f-4b05-9516-b6e84901a865\.user_uploaded\media_1787733428150.png"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

Write-Host "Source Image Size: $($img.Width) x $($img.Height)"
$img.Dispose()
