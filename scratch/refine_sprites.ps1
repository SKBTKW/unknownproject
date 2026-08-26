Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\mam07\.gemini\antigravity\brain\ebea6b65-346f-4b05-9516-b6e84901a865\.user_uploaded\media_1787733428150.png"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

$centers = @(
    @{ cx = 469; topY = 46; botY = 188; name = "campfire_01.png" },
    @{ cx = 614; topY = 56; botY = 188; name = "campfire_02.png" },
    @{ cx = 761; topY = 45; botY = 188; name = "campfire_03.png" },
    @{ cx = 907; topY = 65; botY = 188; name = "campfire_04.png" },
    @{ cx = 469; topY = 246; botY = 388; name = "campfire_05.png" },
    @{ cx = 614; topY = 246; botY = 388; name = "campfire_06.png" },
    @{ cx = 761; topY = 250; botY = 388; name = "campfire_07.png" },
    @{ cx = 907; topY = 265; botY = 388; name = "campfire_08.png" }
)

Write-Host "Refining sprite boxes..."
foreach ($c in $centers) {
    $minX = 9999
    $maxX = -1
    $minY = 9999
    $maxY = -1
    
    $yStart = $c.topY - 10
    $yEnd = $c.botY + 5
    $xStart = $c.cx - 70
    $xEnd = $c.cx + 70
    
    for ($y = $yStart; $y -le $yEnd; $y++) {
        for ($x = $xStart; $x -le $xEnd; $x++) {
            $p = $img.GetPixel($x, $y)
            if ($p.R -lt 240 -or $p.G -lt 240 -or $p.B -lt 240) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    
    $w = $maxX - $minX + 1
    $h = $maxY - $minY + 1
    $cx = [math]::Round(($minX + $maxX) / 2)
    $cy = [math]::Round(($minY + $maxY) / 2)
    Write-Host "Sprite $($c.name): X=[$minX, $maxX] (W=$w), Y=[$minY, $maxY] (H=$h), CenterX=$cx, CenterY=$cy, BottomY=$maxY"
}

$img.Dispose()
