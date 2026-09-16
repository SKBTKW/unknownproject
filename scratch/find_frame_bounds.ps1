Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\mam07\.gemini\antigravity\brain\ebea6b65-346f-4b05-9516-b6e84901a865\.user_uploaded\media_1787733428150.png"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

$colRanges = @(
    @{ minX = 400; maxX = 540 },
    @{ minX = 540; maxX = 690 },
    @{ minX = 690; maxX = 840 },
    @{ minX = 840; maxX = 1000 }
)

$rowRanges = @(
    @{ minY = 40; maxY = 220 },
    @{ minY = 240; maxY = 420 }
)

for ($r = 0; $r -lt 2; $r++) {
    for ($c = 0; $c -lt 4; $c++) {
        $cR = $colRanges[$c]
        $rR = $rowRanges[$r]
        
        $minX = 9999
        $maxX = -1
        $minY = 9999
        $maxY = -1
        
        for ($y = $rR.minY; $y -le $rR.maxY; $y++) {
            for ($x = $cR.minX; $x -le $cR.maxX; $x++) {
                $p = $img.GetPixel($x, $y)
                if ($p.R -lt 240 -or $p.G -lt 240 -or $p.B -lt 240) {
                    if ($x -lt $minX) { $minX = $x }
                    if ($x -gt $maxX) { $maxX = $x }
                    if ($y -lt $minY) { $minY = $y }
                    if ($y -gt $maxY) { $maxY = $y }
                }
            }
        }
        
        $fIdx = $r * 4 + $c + 1
        $w = $maxX - $minX + 1
        $h = $maxY - $minY + 1
        Write-Host "Frame F$fIdx bounds: X=[$minX, $maxX] (W=$w), Y=[$minY, $maxY] (H=$h)"
    }
}

$img.Dispose()
