param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

Add-Type -AssemblyName System.Drawing

$sourceDir = Join-Path $ProjectRoot "store\screenshots"
$outputDir = Join-Path $ProjectRoot "web-page\assets\showcase"

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

function New-RoundRectPath {
  param(
    [System.Drawing.RectangleF]$Rect,
    [float]$Radius = 28
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = [Math]::Max(1, [int]([Math]::Round($Radius * 2)))
  $arc = New-Object System.Drawing.RectangleF($Rect.X, $Rect.Y, $d, $d)

  $path.AddArc($arc, 180, 90)
  $arc.X = $Rect.Right - $d
  $path.AddArc($arc, 270, 90)
  $arc.Y = $Rect.Bottom - $d
  $path.AddArc($arc, 0, 90)
  $arc.X = $Rect.X
  $path.AddArc($arc, 90, 90)
  $path.CloseFigure()
  return $path
}

function Get-CropRect {
  param(
    [int]$ImageWidth,
    [int]$ImageHeight,
    [int]$TargetWidth,
    [int]$TargetHeight,
    [int]$RightTrim = 0
  )

  $effectiveWidth = [Math]::Max(1, $ImageWidth - $RightTrim)
  $targetAspect = $TargetWidth / [double]$TargetHeight
  $effectiveAspect = $effectiveWidth / [double]$ImageHeight

  if ($effectiveAspect -gt $targetAspect) {
    $srcHeight = $ImageHeight
    $srcWidth = [int]([Math]::Round($ImageHeight * $targetAspect))
    $srcX = [int]([Math]::Round(($effectiveWidth - $srcWidth) / 2))
    $srcY = 0
  } else {
    $srcWidth = $effectiveWidth
    $srcHeight = [int]([Math]::Round($effectiveWidth / $targetAspect))
    $srcX = 0
    $srcY = 0
  }

  return [System.Drawing.Rectangle]::new($srcX, $srcY, $srcWidth, $srcHeight)
}

function Draw-Card {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Image]$Image,
    [System.Drawing.RectangleF]$Rect,
    [int]$Radius = 28,
    [int]$RightTrim = 0
  )

  $shadowRect = [System.Drawing.RectangleF]::new($Rect.X + 10, $Rect.Y + 14, $Rect.Width, $Rect.Height)
  $shadowPath = New-RoundRectPath -Rect $shadowRect -Radius $Radius
  $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(36, 0, 38, 92))
  $whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(210, 212, 225, 245), 2)

  try {
    $Graphics.FillPath($shadowBrush, $shadowPath)
  } finally {
    $shadowBrush.Dispose()
    $shadowPath.Dispose()
  }

  $cardPath = New-RoundRectPath -Rect $Rect -Radius $Radius
  try {
    $state = $Graphics.Save()
    $Graphics.FillPath($whiteBrush, $cardPath)
    $Graphics.DrawPath($borderPen, $cardPath)
    $Graphics.SetClip($cardPath)

    $dest = [System.Drawing.Rectangle]::new([int]$Rect.X, [int]$Rect.Y, [int]$Rect.Width, [int]$Rect.Height)
    $src = Get-CropRect -ImageWidth $Image.Width -ImageHeight $Image.Height -TargetWidth $dest.Width -TargetHeight $dest.Height -RightTrim $RightTrim
    $Graphics.DrawImage($Image, $dest, $src, [System.Drawing.GraphicsUnit]::Pixel)
    $Graphics.Restore($state)
  } finally {
    $whiteBrush.Dispose()
    $borderPen.Dispose()
    $cardPath.Dispose()
  }
}

function New-Canvas {
  param(
    [string]$OutputName,
    [string]$Image,
    [int]$RightTrim = 260
  )

  $width = 1200
  $height = 1600
  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      ([System.Drawing.Rectangle]::new(0, 0, $width, $height)),
      [System.Drawing.Color]::FromArgb(245, 249, 255),
      [System.Drawing.Color]::FromArgb(223, 236, 252),
      90
    )
    $graphics.FillRectangle($bg, 0, 0, $width, $height)
    $bg.Dispose()

    $cardRect = [System.Drawing.RectangleF]::new(78, 70, 1044, 1490)
    $path = Join-Path $sourceDir $Image
    $img = [System.Drawing.Image]::FromFile($path)
    try {
      Draw-Card -Graphics $graphics -Image $img -Rect $cardRect -Radius 34 -RightTrim $RightTrim
    } finally {
      $img.Dispose()
    }

    $outPath = Join-Path $outputDir $OutputName
    $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Saved $outPath"
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

New-Canvas -OutputName "student-view-v2.png" -Image "10-certificates.png" -RightTrim 260

New-Canvas -OutputName "teacher-view-v2.png" -Image "04-lesson-today.png" -RightTrim 260

New-Canvas -OutputName "admin-view-v2.png" -Image "02-dashboard.png" -RightTrim 260
