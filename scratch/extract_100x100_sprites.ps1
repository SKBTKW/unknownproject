Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\mam07\.gemini\antigravity\brain\ebea6b65-346f-4b05-9516-b6e84901a865\.user_uploaded\media_1787733428150.png"
$imgBytes = [System.IO.File]::ReadAllBytes($srcPath)
$ms = New-Object System.IO.MemoryStream(,$imgBytes)
$img = [System.Drawing.Bitmap]::FromStream($ms)

$destDir = (Resolve-Path "game/assets").Path

$f1 = @{ cx = 469; botY = 193; name = "campfire_01.png" }
$f2 = @{ cx = 614; botY = 193; name = "campfire_02.png" }
$f3 = @{ cx = 761; botY = 193; name = "campfire_03.png" }
$f4 = @{ cx = 907; botY = 193; name = "campfire_04.png" }
$f5 = @{ cx = 469; botY = 393; name = "campfire_05.png" }
$f6 = @{ cx = 614; botY = 393; name = "campfire_06.png" }
$f7 = @{ cx = 761; botY = 393; name = "campfire_07.png" }
$f8 = @{ cx = 907; botY = 393; name = "campfire_08.png" }

$frames = @($f1, $f2, $f3, $f4, $f5, $f6, $f7, $f8)

$cropW = 126
$cropH = 168

foreach ($f in $frames) {
    $outBmp = New-Object System.Drawing.Bitmap(100, 100, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($outBmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    
    $cropX = [int]($f.cx - $cropW / 2)
    $cropY = [int]($f.botY - $cropH + 4)
    
    $tempBmp = New-Object System.Drawing.Bitmap($cropW, $cropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    for ($y = 0; $y -lt $cropH; $y++) {
        for ($x = 0; $x -lt $cropW; $x++) {
            $srcX = $cropX + $x
            $srcY = $cropY + $y
            if ($srcX -ge 0 -and $srcX -lt $img.Width -and $srcY -ge 0 -and $srcY -lt $img.Height) {
                $p = $img.GetPixel($srcX, $srcY)
                if ($p.R -ge 240 -and $p.G -ge 240 -and $p.B -ge 240) {
                    $tempBmp.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
                } else {
                    $tempBmp.SetPixel($x, $y, $p)
                }
            }
        }
    }
    
    $destW = 76
    $destH = 100
    $destX = [int]((100 - $destW) / 2)
    $destY = 0
    $rect = New-Object System.Drawing.Rectangle($destX, $destY, $destW, $destH)
    $g.DrawImage($tempBmp, $rect, 0, 0, $cropW, $cropH, [System.Drawing.GraphicsUnit]::Pixel)
    
    $outPath = [System.IO.Path]::Combine($destDir, $f.name)
    if (Test-Path $outPath) { Remove-Item -Force $outPath }
    
    $outMs = New-Object System.IO.MemoryStream
    $outBmp.Save($outMs, [System.Drawing.Imaging.ImageFormat]::Png)
    [System.IO.File]::WriteAllBytes($outPath, $outMs.ToArray())
    $outMs.Dispose()
    
    Write-Host "Saved 100x100 transparent sprite: $($f.name) (size: $((Get-Item $outPath).Length) bytes)"
    
    $tempBmp.Dispose()
    $g.Dispose()
    $outBmp.Dispose()
}

# 2. 背景の切り出し
$bgCropX = 8
$bgCropY = 45
$bgCropW = 380
$bgCropH = 370

$bgOut = New-Object System.Drawing.Bitmap(100, 100, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bgG = [System.Drawing.Graphics]::FromImage($bgOut)
$bgG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$bgRect = New-Object System.Drawing.Rectangle(0, 0, 100, 100)
$bgG.DrawImage($img, $bgRect, $bgCropX, $bgCropY, $bgCropW, $bgCropH, [System.Drawing.GraphicsUnit]::Pixel)

$bgPath = [System.IO.Path]::Combine($destDir, "campfire_background.png")
if (Test-Path $bgPath) { Remove-Item -Force $bgPath }
$bgMs = New-Object System.IO.MemoryStream
$bgOut.Save($bgMs, [System.Drawing.Imaging.ImageFormat]::Png)
[System.IO.File]::WriteAllBytes($bgPath, $bgMs.ToArray())
$bgMs.Dispose()

Write-Host "Saved 100x100 background: campfire_background.png (size: $((Get-Item $bgPath).Length) bytes)"

$bgG.Dispose()
$bgOut.Dispose()
$img.Dispose()
$ms.Dispose()
