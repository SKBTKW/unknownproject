Add-Type -AssemblyName System.Drawing

$destDir = (Resolve-Path "game/assets").Path

# 1. campfire_background.png 検証
$bgPath = [System.IO.Path]::Combine($destDir, "campfire_background.png")
$bgBmp = [System.Drawing.Bitmap]::FromFile($bgPath)
Write-Host "1. campfire_background.png: $($bgBmp.Width)x$($bgBmp.Height) (Exists: $(Test-Path $bgPath))"

# 2. campfire_flame_spritesheet.png 検証
$sheetPath = [System.IO.Path]::Combine($destDir, "campfire_flame_spritesheet.png")
$sheetBmp = [System.Drawing.Bitmap]::FromFile($sheetPath)
Write-Host "2. campfire_flame_spritesheet.png: $($sheetBmp.Width)x$($sheetBmp.Height) (Exists: $(Test-Path $sheetPath))"

# 3. campfire_flame_01.png ... campfire_flame_08.png 検証
for ($i = 1; $i -le 8; $i++) {
    $fPath = [System.IO.Path]::Combine($destDir, "campfire_flame_0$i.png")
    $fBmp = [System.Drawing.Bitmap]::FromFile($fPath)
    Write-Host "3. campfire_flame_0$i.png: $($fBmp.Width)x$($fBmp.Height) (Corner A=$($fBmp.GetPixel(0,0).A))"
    $fBmp.Dispose()
}

# 4. verification_contact_sheet.png 生成 (8コマ合成コンタクトシート: 800x100)
$contact = New-Object System.Drawing.Bitmap(800, 100, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($contact)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

for ($i = 1; $i -le 8; $i++) {
    $fPath = [System.IO.Path]::Combine($destDir, "campfire_flame_0$i.png")
    $fBmp = [System.Drawing.Bitmap]::FromFile($fPath)
    $destX = ($i - 1) * 100
    
    # 背景を描画
    $g.DrawImage($bgBmp, $destX, 0, 100, 100)
    # 前面炎を描画 (原点 0,0 一致)
    $g.DrawImage($fBmp, $destX, 0, 100, 100)
    
    $fBmp.Dispose()
}

$contactPath = [System.IO.Path]::Combine($destDir, "verification_contact_sheet.png")
if (Test-Path $contactPath) { Remove-Item -Force $contactPath }
$cMs = New-Object System.IO.MemoryStream
$contact.Save($cMs, [System.Drawing.Imaging.ImageFormat]::Png)
[System.IO.File]::WriteAllBytes($contactPath, $cMs.ToArray())
$cMs.Dispose()
$g.Dispose()
$contact.Dispose()

Write-Host "4. verification_contact_sheet.png created: 800x100 (size: $((Get-Item $contactPath).Length) bytes)"

$bgBmp.Dispose()
$sheetBmp.Dispose()
