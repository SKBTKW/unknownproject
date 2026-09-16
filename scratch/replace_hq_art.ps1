Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\mam07\.gemini\antigravity\brain\ebea6b65-346f-4b05-9516-b6e84901a865\.user_uploaded\media_1787733775258.jpg"
$imgBytes = [System.IO.File]::ReadAllBytes($srcPath)
$ms = New-Object System.IO.MemoryStream(,$imgBytes)
$img = [System.Drawing.Bitmap]::FromStream($ms)

$destDir = (Resolve-Path "game/assets").Path

# 1. マスター画像として保存 (hq_master_art.png)
$masterPath = [System.IO.Path]::Combine($destDir, "hq_master_art.png")
if (Test-Path $masterPath) { Remove-Item -Force $masterPath }
$mMs = New-Object System.IO.MemoryStream
$img.Save($mMs, [System.Drawing.Imaging.ImageFormat]::Png)
[System.IO.File]::WriteAllBytes($masterPath, $mMs.ToArray())
$mMs.Dispose()
Write-Host "Saved hq_master_art.png (size: $((Get-Item $masterPath).Length) bytes)"

# 2. 内側の砦イラスト部分 (金枠の内側: X=[100, 865], Y=[120, 885]) をクロップして campfire_background.png として保存
$cropX = 100
$cropY = 120
$cropW = 765
$cropH = 765

$bgOut = New-Object System.Drawing.Bitmap(100, 100, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bgG = [System.Drawing.Graphics]::FromImage($bgOut)
$bgG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$bgRect = New-Object System.Drawing.Rectangle(0, 0, 100, 100)
$bgG.DrawImage($img, $bgRect, $cropX, $cropY, $cropW, $cropH, [System.Drawing.GraphicsUnit]::Pixel)

$bgPath = [System.IO.Path]::Combine($destDir, "campfire_background.png")
if (Test-Path $bgPath) { Remove-Item -Force $bgPath }
$bgMs = New-Object System.IO.MemoryStream
$bgOut.Save($bgMs, [System.Drawing.Imaging.ImageFormat]::Png)
[System.IO.File]::WriteAllBytes($bgPath, $bgMs.ToArray())
$bgMs.Dispose()

Write-Host "Saved new campfire_background.png from cropped master art (size: $((Get-Item $bgPath).Length) bytes)"

$bgG.Dispose()
$bgOut.Dispose()
$img.Dispose()
$ms.Dispose()
