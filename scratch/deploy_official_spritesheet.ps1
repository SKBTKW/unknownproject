Add-Type -AssemblyName System.Drawing

$src = "C:\Users\mam07\.gemini\antigravity\brain\ebea6b65-346f-4b05-9516-b6e84901a865\.user_uploaded\media_1787741810179.png"
$destDir = (Resolve-Path "game/assets").Path

$sheetDest = [System.IO.Path]::Combine($destDir, "campfire_flame_spritesheet.png")
[System.IO.File]::Copy($src, $sheetDest, $true)

$sheetBmp = [System.Drawing.Bitmap]::FromFile($sheetDest)
Write-Host "Loaded spritesheet: $($sheetBmp.Width)x$($sheetBmp.Height)"

$i = 1
while ($i -le 8) {
    $outBmp = New-Object System.Drawing.Bitmap(100, 100, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($outBmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    
    $srcX = ($i - 1) * 100
    $rect = New-Object System.Drawing.Rectangle(0, 0, 100, 100)
    $g.DrawImage($sheetBmp, $rect, $srcX, 0, 100, 100, [System.Drawing.GraphicsUnit]::Pixel)
    
    $fDest = [System.IO.Path]::Combine($destDir, "campfire_flame_0$i.png")
    if (Test-Path $fDest) { Remove-Item -Force $fDest }
    
    $fMs = New-Object System.IO.MemoryStream
    $outBmp.Save($fMs, [System.Drawing.Imaging.ImageFormat]::Png)
    [System.IO.File]::WriteAllBytes($fDest, $fMs.ToArray())
    
    $fMs.Dispose()
    $g.Dispose()
    $outBmp.Dispose()
    Write-Host "Extracted campfire_flame_0$i.png"
    $i++
}

$bgPath = [System.IO.Path]::Combine($destDir, "campfire_background.png")
$bgBmp = [System.Drawing.Bitmap]::FromFile($bgPath)

$contact = New-Object System.Drawing.Bitmap(800, 100, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$cg = [System.Drawing.Graphics]::FromImage($contact)
$cg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor

$k = 0
while ($k -lt 8) {
    $destX = $k * 100
    $cg.DrawImage($bgBmp, $destX, 0, 100, 100)
    $k++
}
$cg.DrawImage($sheetBmp, 0, 0, 800, 100)

$contactPath = [System.IO.Path]::Combine($destDir, "verification_contact_sheet.png")
if (Test-Path $contactPath) { Remove-Item -Force $contactPath }
$cMs = New-Object System.IO.MemoryStream
$contact.Save($cMs, [System.Drawing.Imaging.ImageFormat]::Png)
[System.IO.File]::WriteAllBytes($contactPath, $cMs.ToArray())

$cMs.Dispose()
$cg.Dispose()
$contact.Dispose()
$bgBmp.Dispose()
$sheetBmp.Dispose()

Write-Host "All assets successfully extracted from official sheet!"
