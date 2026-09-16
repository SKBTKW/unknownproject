Add-Type -AssemblyName System.Drawing

$destDir = (Resolve-Path "game/assets").Path

# 1. campfire_01.png ... campfire_08.png を campfire_flame_01.png ... campfire_flame_08.png としてコピー/リネーム配置
for ($i = 1; $i -le 8; $i++) {
    $src = [System.IO.Path]::Combine($destDir, "campfire_0$i.png")
    $dest = [System.IO.Path]::Combine($destDir, "campfire_flame_0$i.png")
    [System.IO.File]::Copy($src, $dest, $true)
    Write-Host "Created campfire_flame_0$i.png"
}

# 2. 800x100 の campfire_flame_spritesheet.png を作成 (8コマ横並び)
$sheet = New-Object System.Drawing.Bitmap(800, 100, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($sheet)
$g.Clear([System.Drawing.Color]::Transparent)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

for ($i = 1; $i -le 8; $i++) {
    $fPath = [System.IO.Path]::Combine($destDir, "campfire_flame_0$i.png")
    $fBmp = [System.Drawing.Bitmap]::FromFile($fPath)
    $destX = ($i - 1) * 100
    $rect = New-Object System.Drawing.Rectangle($destX, 0, 100, 100)
    $g.DrawImage($fBmp, $rect, 0, 0, 100, 100, [System.Drawing.GraphicsUnit]::Pixel)
    $fBmp.Dispose()
}

$sheetPath = [System.IO.Path]::Combine($destDir, "campfire_flame_spritesheet.png")
if (Test-Path $sheetPath) { Remove-Item -Force $sheetPath }
$sMs = New-Object System.IO.MemoryStream
$sheet.Save($sMs, [System.Drawing.Imaging.ImageFormat]::Png)
[System.IO.File]::WriteAllBytes($sheetPath, $sMs.ToArray())
$sMs.Dispose()
$g.Dispose()
$sheet.Dispose()

Write-Host "Created 800x100 campfire_flame_spritesheet.png (size: $((Get-Item $sheetPath).Length) bytes)"
