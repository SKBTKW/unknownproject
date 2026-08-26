Add-Type -AssemblyName System.Drawing

$destDir = (Resolve-Path "game/assets").Path
$bgPath = [System.IO.Path]::Combine($destDir, "campfire_background.png")
$bgBmp = [System.Drawing.Bitmap]::FromFile($bgPath)

# 8コマの合成ビットマップリストを作成
$frames = @()
for ($i = 1; $i -le 8; $i++) {
    $fPath = [System.IO.Path]::Combine($destDir, "campfire_flame_0$i.png")
    $fBmp = [System.Drawing.Bitmap]::FromFile($fPath)
    
    $comp = New-Object System.Drawing.Bitmap(100, 100, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($comp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.DrawImage($bgBmp, 0, 0, 100, 100)
    $g.DrawImage($fBmp, 0, 0, 100, 100)
    
    $frames += $comp
    $fBmp.Dispose()
    $g.Dispose()
}

Write-Host "All 8 composite frames generated for verification GIF."
$bgBmp.Dispose()
