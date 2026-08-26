Add-Type -AssemblyName System.Drawing

$destDir = (Resolve-Path "game/assets").Path
$basePath = "C:\Users\mam07\.gemini\antigravity\brain\ebea6b65-346f-4b05-9516-b6e84901a865\.user_uploaded\"

# 7つの純粋な炎ファイル
$sourceFiles = @(
    "media_1787740365760.png",
    "media_1787740365758.png",
    "media_1787740353762.png",
    "media_1787740353763.png",
    "media_1787740621743.png",
    "media_1787740365757.png",
    "media_1787740581008.png"
)

for ($i = 0; $i -lt 7; $i++) {
    $srcPath = [System.IO.Path]::Combine($basePath, $sourceFiles[$i])
    $destPath = [System.IO.Path]::Combine($destDir, ("campfire_flame_0" + ($i + 1) + ".png"))
    [System.IO.File]::Copy($srcPath, $destPath, $true)
    Write-Host "Set $($destPath)"
}

# 8番目のフレームを F7 と F1 の合成として作成
$f7Path = [System.IO.Path]::Combine($basePath, $sourceFiles[6])
$f1Path = [System.IO.Path]::Combine($basePath, $sourceFiles[0])

$f7Bytes = [System.IO.File]::ReadAllBytes($f7Path)
$f1Bytes = [System.IO.File]::ReadAllBytes($f1Path)

$ms7 = New-Object System.IO.MemoryStream(,$f7Bytes)
$ms1 = New-Object System.IO.MemoryStream(,$f1Bytes)

$f7Img = [System.Drawing.Bitmap]::FromStream($ms7)
$f1Img = [System.Drawing.Bitmap]::FromStream($ms1)

$f8Bmp = New-Object System.Drawing.Bitmap(100, 100, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt 100; $y++) {
    for ($x = 0; $x -lt 100; $x++) {
        $p7 = $f7Img.GetPixel($x, $y)
        $p1 = $f1Img.GetPixel($x, $y)
        
        if ($p1.A -gt 50 -and $p7.A -gt 50) {
            $r = [int](($p7.R * 0.4) + ($p1.R * 0.6))
            $g = [int](($p7.G * 0.4) + ($p1.G * 0.6))
            $b = [int](($p7.B * 0.4) + ($p1.B * 0.6))
            $a = [int](($p7.A * 0.4) + ($p1.A * 0.6))
            $f8Bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($a, $r, $g, $b))
        } elseif ($p1.A -gt 50) {
            $f8Bmp.SetPixel($x, $y, $p1)
        } elseif ($p7.A -gt 150) {
            $a = [int]($p7.A * 0.6)
            $f8Bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($a, $p7.R, $p7.G, $p7.B))
        }
    }
}

$f8Dest = [System.IO.Path]::Combine($destDir, "campfire_flame_08.png")
if (Test-Path $f8Dest) { Remove-Item -Force $f8Dest }
$f8Ms = New-Object System.IO.MemoryStream
$f8Bmp.Save($f8Ms, [System.Drawing.Imaging.ImageFormat]::Png)
[System.IO.File]::WriteAllBytes($f8Dest, $f8Ms.ToArray())

$f8Ms.Dispose()
$f8Bmp.Dispose()
$f7Img.Dispose()
$f1Img.Dispose()
$ms7.Dispose()
$ms1.Dispose()

Write-Host "Created campfire_flame_08.png successfully"

# スプライトシート再生成
$sheet = New-Object System.Drawing.Bitmap(800, 100, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($sheet)
$g.Clear([System.Drawing.Color]::Transparent)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor

for ($i = 1; $i -le 8; $i++) {
    $fPath = [System.IO.Path]::Combine($destDir, "campfire_flame_0$i.png")
    $bBytes = [System.IO.File]::ReadAllBytes($fPath)
    $bMs = New-Object System.IO.MemoryStream(,$bBytes)
    $fBmp = [System.Drawing.Bitmap]::FromStream($bMs)
    $destX = ($i - 1) * 100
    $rect = New-Object System.Drawing.Rectangle($destX, 0, 100, 100)
    $g.DrawImage($fBmp, $rect, 0, 0, 100, 100, [System.Drawing.GraphicsUnit]::Pixel)
    $fBmp.Dispose()
    $bMs.Dispose()
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
