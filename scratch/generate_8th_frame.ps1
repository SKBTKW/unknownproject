Add-Type -AssemblyName System.Drawing

$destDir = (Resolve-Path "game/assets").Path
$basePath = "C:\Users\mam07\.gemini\antigravity\brain\ebea6b65-346f-4b05-9516-b6e84901a865\.user_uploaded\"

$s1 = "media_1787740365760.png"
$s2 = "media_1787740365758.png"
$s3 = "media_1787740353762.png"
$s4 = "media_1787740353763.png"
$s5 = "media_1787740621743.png"
$s6 = "media_1787740365757.png"
$s7 = "media_1787740581008.png"

$sourceList = @($s1, $s2, $s3, $s4, $s5, $s6, $s7)

for ($i = 0; $i -lt 7; $i++) {
    $src = [System.IO.Path]::Combine($basePath, $sourceList[$i])
    $destName = "campfire_0" + ($i + 1) + ".png"
    $dest = [System.IO.Path]::Combine($destDir, $destName)
    [System.IO.File]::Copy($src, $dest, $true)
    Write-Host "Set $destName from $($sourceList[$i])"
}

# Generate 8th frame
$f7Img = [System.Drawing.Bitmap]::FromFile([System.IO.Path]::Combine($basePath, $s7))
$f1Img = [System.Drawing.Bitmap]::FromFile([System.IO.Path]::Combine($basePath, $s1))

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

$f7Img.Dispose()
$f1Img.Dispose()

$f8Dest = [System.IO.Path]::Combine($destDir, "campfire_08.png")
if (Test-Path $f8Dest) { Remove-Item -Force $f8Dest }
$f8Ms = New-Object System.IO.MemoryStream
$f8Bmp.Save($f8Ms, [System.Drawing.Imaging.ImageFormat]::Png)
[System.IO.File]::WriteAllBytes($f8Dest, $f8Ms.ToArray())
$f8Ms.Dispose()
$f8Bmp.Dispose()

Write-Host "Generated custom frame campfire_08.png (size: $((Get-Item $f8Dest).Length) bytes)"
