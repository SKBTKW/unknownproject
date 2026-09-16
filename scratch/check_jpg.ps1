Add-Type -AssemblyName System.Drawing
$p = "C:\Users\mam07\.gemini\antigravity\brain\ebea6b65-346f-4b05-9516-b6e84901a865\.user_uploaded\media_1787733775258.jpg"
$img = [System.Drawing.Bitmap]::FromFile($p)
Write-Host "Image size: $($img.Width) x $($img.Height)"
$img.Dispose()
