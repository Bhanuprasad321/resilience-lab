Add-Type -AssemblyName System.Drawing

$width = 1300
$height = 750
$bmp = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)

$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Clear Background (Dark Canvas matching reference)
$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(11, 12, 16))
$g.FillRectangle($bgBrush, 0, 0, $width, $height)

# Fonts
$fontTitle = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$fontSubtitle = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Regular)
$fontCardHeader = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$fontCardBody = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$fontCardSmall = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Regular)
$fontBadge = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)

# String Formats
$centerFormat = New-Object System.Drawing.StringFormat
$centerFormat.Alignment = [System.Drawing.StringAlignment]::Center
$centerFormat.LineAlignment = [System.Drawing.StringAlignment]::Center

# Helper: Draw Rounded Rectangle
function Draw-RoundedCard($graphics, $fillColor, $borderColor, $x, $y, $w, $h, $radius) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()

    # Drop shadow
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 0, 0, 0))
    for ($i = 6; $i -gt 0; $i--) {
        $graphics.TranslateTransform(0, 1)
        $graphics.FillPath($shadowBrush, $path)
    }
    $graphics.TranslateTransform(0, -6)

    $brush = New-Object System.Drawing.SolidBrush($fillColor)
    $pen = New-Object System.Drawing.Pen($borderColor, 1.8)
    $graphics.FillPath($brush, $path)
    $graphics.DrawPath($pen, $path)
}

# Helper: Draw 3D Cylinder
function Draw-Cylinder($graphics, $bodyColor, $topColor, $borderColor, $x, $y, $w, $h, $capH) {
    # Shadow
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(50, 0, 0, 0))
    $graphics.FillEllipse($shadowBrush, $x, $y + $h - ($capH / 2) + 4, $w, $capH)

    # Body Path
    $bodyPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $bodyPath.AddArc($x, $y, $w, $capH, 180, -180)
    $bodyPath.AddLine($x + $w, $y + ($capH / 2), $x + $w, $y + $h)
    $bodyPath.AddArc($x, $y + $h - ($capH / 2), $w, $capH, 0, 180)
    $bodyPath.AddLine($x, $y + $h, $x, $y + ($capH / 2))
    $bodyPath.CloseFigure()

    $bBrush = New-Object System.Drawing.SolidBrush($bodyColor)
    $tBrush = New-Object System.Drawing.SolidBrush($topColor)
    $pen = New-Object System.Drawing.Pen($borderColor, 1.8)

    $graphics.FillPath($bBrush, $bodyPath)
    $graphics.DrawPath($pen, $bodyPath)

    # Bottom edge arc
    $graphics.DrawArc($pen, $x, $y + $h - ($capH / 2), $w, $capH, 0, 180)

    # Top cap ellipse
    $graphics.FillEllipse($tBrush, $x, $y, $w, $capH)
    $graphics.DrawEllipse($pen, $x, $y, $w, $capH)
}

# Helper: Draw Neon Green Arrow with Arrowhead and Badge
function Draw-GreenArrow($graphics, $x1, $y1, $x2, $y2, $badgeText, $badgeWidth) {
    $neonGreen = [System.Drawing.Color]::FromArgb(16, 185, 129)
    $arrowPen = New-Object System.Drawing.Pen($neonGreen, 3.2)
    $arrowPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round

    $graphics.DrawLine($arrowPen, $x1, $y1, $x2, $y2)

    # Arrowhead
    $arrowBrush = New-Object System.Drawing.SolidBrush($neonGreen)
    [System.Drawing.PointF[]]$head = @(
        [System.Drawing.PointF]::new($x2, $y2),
        [System.Drawing.PointF]::new(($x2 - 10), ($y2 - 6)),
        [System.Drawing.PointF]::new(($x2 - 10), ($y2 + 6))
    )
    $graphics.FillPolygon($arrowBrush, $head)

    # Badge Label
    if ($badgeText) {
        $midX = ($x1 + $x2) / 2
        $midY = ($y1 + $y2) / 2 - 16
        $badgeRect = New-Object System.Drawing.RectangleF(($midX - ($badgeWidth / 2)), $midY, $badgeWidth, 20)
        $badgeBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20, 24, 33))
        $badgeBorder = New-Object System.Drawing.Pen($neonGreen, 1)
        $graphics.FillRectangle($badgeBg, $badgeRect)
        $graphics.DrawRectangle($badgeBorder, $badgeRect.X, $badgeRect.Y, $badgeRect.Width, $badgeRect.Height)

        $badgeTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(52, 211, 153))
        $graphics.DrawString($badgeText, $fontBadge, $badgeTextBrush, $badgeRect, $centerFormat)
    }
}

# 1. Header
$titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 250, 252))
$subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184))
$g.DrawString("Mini Store (Resilience Lab) - Architecture Phase 1", $fontTitle, $titleBrush, (New-Object System.Drawing.RectangleF(0, 35, $width, 35)), $centerFormat)
$g.DrawString("Single-Instance Baseline: In-Memory Sessions & Unindexed Search Bottleneck (v1-baseline)", $fontSubtitle, $subBrush, (New-Object System.Drawing.RectangleF(0, 72, $width, 25)), $centerFormat)

# 2. Docker Compose Boundary (Dashed Box)
$dockerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(35, 42, 54), 1.8)
$dockerPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
$dockerBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(17, 20, 26))
$g.FillRectangle($dockerBg, 360, 130, 880, 560)
$g.DrawRectangle($dockerPen, 360, 130, 880, 560)

$dockerBadgeBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(28, 33, 44))
$g.FillRectangle($dockerBadgeBg, 380, 145, 230, 24)
$dockerLabelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184))
$g.DrawString("DOCKER COMPOSE NETWORK", $fontBadge, $dockerLabelBrush, (New-Object System.Drawing.RectangleF(380, 145, 230, 24)), $centerFormat)

# ==================== COMPONENT 1: USERS (Pink) ====================
$pinkFill = [System.Drawing.Color]::FromArgb(255, 107, 139)
$pinkBorder = [System.Drawing.Color]::FromArgb(224, 86, 117)
Draw-RoundedCard $g $pinkFill $pinkBorder 60 320 220 120 12

$darkText = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 23, 42))
$g.DrawString("Users & Autocannon", $fontCardHeader, $darkText, (New-Object System.Drawing.RectangleF(60, 342, 220, 24)), $centerFormat)
$g.DrawString("Load Test Runner", $fontCardBody, $darkText, (New-Object System.Drawing.RectangleF(60, 370, 220, 20)), $centerFormat)
$g.DrawString("20 Concurrent Connections", $fontCardSmall, $darkText, (New-Object System.Drawing.RectangleF(60, 395, 220, 20)), $centerFormat)

# Arrow 1: Users -> App Server
Draw-GreenArrow $g 280 380 430 380 "HTTP :3000" 90

# ==================== COMPONENT 2: APP SERVER (Cyan) ====================
$cyanFill = [System.Drawing.Color]::FromArgb(0, 210, 211)
$cyanBorder = [System.Drawing.Color]::FromArgb(0, 180, 181)
Draw-RoundedCard $g $cyanFill $cyanBorder 430 300 250 155 12

$cyanDark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(4, 47, 46))
$g.DrawString("Single App Server", $fontCardHeader, $cyanDark, (New-Object System.Drawing.RectangleF(430, 320, 250, 24)), $centerFormat)
$g.DrawString("Node.js 20 + Express", $fontCardBody, $cyanDark, (New-Object System.Drawing.RectangleF(430, 346, 250, 20)), $centerFormat)
$g.DrawString("Container: resilience-app", $fontCardSmall, $cyanDark, (New-Object System.Drawing.RectangleF(430, 375, 250, 18)), $centerFormat)
$g.DrawString("CPU Limit: 0.5 Cores", $fontCardSmall, $cyanDark, (New-Object System.Drawing.RectangleF(430, 395, 250, 18)), $centerFormat)
$g.DrawString("Header: X-Instance-Id", $fontCardSmall, $cyanDark, (New-Object System.Drawing.RectangleF(430, 415, 250, 18)), $centerFormat)

# Arrow 2A: App -> In-Memory Sessions (Branch up)
$neonGreen = [System.Drawing.Color]::FromArgb(16, 185, 129)
$branchPen = New-Object System.Drawing.Pen($neonGreen, 3.2)
$g.DrawLine($branchPen, 555, 300, 555, 220)
$g.DrawLine($branchPen, 555, 220, 750, 220)
[System.Drawing.PointF[]]$headUp = @(
    [System.Drawing.PointF]::new(750, 220),
    [System.Drawing.PointF]::new(740, 214),
    [System.Drawing.PointF]::new(740, 226)
)
$g.FillPolygon((New-Object System.Drawing.SolidBrush($neonGreen)), $headUp)

# Session Badge
$badgeRectS = New-Object System.Drawing.RectangleF(595, 202, 105, 20)
$g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20, 24, 33))), $badgeRectS)
$g.DrawRectangle((New-Object System.Drawing.Pen($neonGreen, 1)), $badgeRectS.X, $badgeRectS.Y, $badgeRectS.Width, $badgeRectS.Height)
$g.DrawString("Session State", $fontBadge, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(52, 211, 153))), $badgeRectS, $centerFormat)

# ==================== COMPONENT 3: IN-MEMORY SESSIONS (Orange) ====================
$orangeFill = [System.Drawing.Color]::FromArgb(255, 169, 77)
$orangeBorder = [System.Drawing.Color]::FromArgb(247, 144, 42)
Draw-RoundedCard $g $orangeFill $orangeBorder 750 170 240 100 12

$orangeDark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(67, 20, 7))
$g.DrawString("In-Memory Sessions", $fontCardHeader, $orangeDark, (New-Object System.Drawing.RectangleF(750, 188, 240, 24)), $centerFormat)
$g.DrawString("express-session (MemoryStore)", $fontCardBody, $orangeDark, (New-Object System.Drawing.RectangleF(750, 214, 240, 20)), $centerFormat)
$g.DrawString("Stateful: Lost on container restart", $fontCardSmall, $orangeDark, (New-Object System.Drawing.RectangleF(750, 236, 240, 18)), $centerFormat)

# Arrow 2B: App -> MongoDB
Draw-GreenArrow $g 680 380 780 380 "Port 27017" 80

# ==================== COMPONENT 4: MONGODB CYLINDER (Mint) ====================
$mintBody = [System.Drawing.Color]::FromArgb(32, 201, 151)
$mintTop = [System.Drawing.Color]::FromArgb(56, 217, 169)
$mintBorder = [System.Drawing.Color]::FromArgb(18, 184, 134)
Draw-Cylinder $g $mintBody $mintTop $mintBorder 780 330 200 115 36

$mintDark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(4, 47, 46))
$g.DrawString("MongoDB 7 Instance", $fontCardHeader, $mintDark, (New-Object System.Drawing.RectangleF(780, 368, 200, 22)), $centerFormat)
$g.DrawString("resilience-mongo", $fontCardBody, $mintDark, (New-Object System.Drawing.RectangleF(780, 390, 200, 18)), $centerFormat)
$g.DrawString("CPU Limit: 1.0 Cores", $fontCardSmall, $mintDark, (New-Object System.Drawing.RectangleF(780, 410, 200, 16)), $centerFormat)

# Arrow 3: MongoDB -> Persistent Volume (Branch down)
$g.DrawLine($branchPen, 880, 460, 880, 525)
$g.DrawLine($branchPen, 880, 525, 990, 525)
[System.Drawing.PointF[]]$headVol = @(
    [System.Drawing.PointF]::new(990, 525),
    [System.Drawing.PointF]::new(980, 519),
    [System.Drawing.PointF]::new(980, 531)
)
$g.FillPolygon((New-Object System.Drawing.SolidBrush($neonGreen)), $headVol)

$badgeRectV = New-Object System.Drawing.RectangleF(895, 508, 85, 20)
$g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20, 24, 33))), $badgeRectV)
$g.DrawRectangle((New-Object System.Drawing.Pen($neonGreen, 1)), $badgeRectV.X, $badgeRectV.Y, $badgeRectV.Width, $badgeRectV.Height)
$g.DrawString("Data Volume", $fontBadge, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(52, 211, 153))), $badgeRectV, $centerFormat)

# ==================== COMPONENT 5: MONGO_DATA VOLUME CYLINDER (Green) ====================
$greenBody = [System.Drawing.Color]::FromArgb(81, 207, 102)
$greenTop = [System.Drawing.Color]::FromArgb(105, 219, 124)
$greenBorder = [System.Drawing.Color]::FromArgb(64, 192, 87)
Draw-Cylinder $g $greenBody $greenTop $greenBorder 990 470 210 115 36

$greenDark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(5, 46, 22))
$g.DrawString("mongo_data Volume", $fontCardHeader, $greenDark, (New-Object System.Drawing.RectangleF(990, 508, 210, 22)), $centerFormat)
$g.DrawString("50,000 Seeded Products", $fontCardBody, $greenDark, (New-Object System.Drawing.RectangleF(990, 530, 210, 18)), $centerFormat)
$g.DrawString("Unindexed COLLSCAN", $fontCardSmall, $greenDark, (New-Object System.Drawing.RectangleF(990, 550, 210, 16)), $centerFormat)

# ==================== BOTTLENECK CALLOUT BANNER ====================
Draw-RoundedCard $g ([System.Drawing.Color]::FromArgb(24, 25, 32)) ([System.Drawing.Color]::FromArgb(239, 68, 68)) 430 600 770 75 10

# Red Tag
$tagRect = New-Object System.Drawing.RectangleF(445, 615, 90, 22)
$g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(239, 68, 68))), $tagRect)
$g.DrawString("BOTTLENECK", $fontBadge, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)), $tagRect, $centerFormat)

$alertTitleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 113, 113))
$g.DrawString("Phase 1 Architectural Bottlenecks:", $fontCardBody, $alertTitleBrush, 545, 616)

$alertTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(203, 213, 225))
$g.DrawString("1. Unindexed Regex COLLSCAN: Search across 50,000 documents consumes 100% CPU on full scans (?search=zzzxqy).", $fontCardSmall, $alertTextBrush, 445, 645)

# Save to byte array in memory, then output to file
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$bytes = $ms.ToArray()

$ms.Dispose()
$g.Dispose()
$bmp.Dispose()

$outputPath = "D:\projects\Mini Store\architecture\architecture_phase-1.png"
[System.IO.File]::WriteAllBytes($outputPath, $bytes)
Write-Output "Image generated and saved successfully to: $outputPath (Bytes: $($bytes.Length))"
