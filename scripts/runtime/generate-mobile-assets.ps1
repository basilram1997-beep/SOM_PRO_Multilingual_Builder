Add-Type -AssemblyName System.Drawing

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$sourceIcon = Join-Path $repoRoot "apps\frontend\public\favicon.png"
$assetsDir = Join-Path $repoRoot "assets"

New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null

function New-ArgbColor([int]$r, [int]$g, [int]$b, [int]$a = 255) {
  return [System.Drawing.Color]::FromArgb($a, $r, $g, $b)
}

function Test-BackgroundPixel([System.Drawing.Color]$color, [System.Drawing.Color]$background, [int]$tolerance = 18) {
  return (
    [Math]::Abs($color.R - $background.R) -le $tolerance -and
    [Math]::Abs($color.G - $background.G) -le $tolerance -and
    [Math]::Abs($color.B - $background.B) -le $tolerance
  )
}

function New-TransparentCutout([string]$inputPath, [int]$targetSize) {
  $sourceImage = [System.Drawing.Bitmap]::FromFile($inputPath)
  try {
    $background = $sourceImage.GetPixel(0, 0)
    $cutout = New-Object System.Drawing.Bitmap $sourceImage.Width, $sourceImage.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      for ($x = 0; $x -lt $sourceImage.Width; $x++) {
        for ($y = 0; $y -lt $sourceImage.Height; $y++) {
          $pixel = $sourceImage.GetPixel($x, $y)
          if (Test-BackgroundPixel -color $pixel -background $background) {
            $cutout.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $pixel.R, $pixel.G, $pixel.B))
          } else {
            $cutout.SetPixel($x, $y, $pixel)
          }
        }
      }

      $canvas = New-Object System.Drawing.Bitmap $targetSize, $targetSize, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      try {
        $graphics = [System.Drawing.Graphics]::FromImage($canvas)
        try {
          $graphics.Clear([System.Drawing.Color]::Transparent)
          $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
          $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
          $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

          $padding = [int]($targetSize * 0.08)
          $drawSize = $targetSize - ($padding * 2)
          $graphics.DrawImage($cutout, $padding, $padding, $drawSize, $drawSize)
        } finally {
          $graphics.Dispose()
        }
        return $canvas
      } catch {
        $canvas.Dispose()
        throw
      }
    } catch {
      $cutout.Dispose()
      throw
    }
  } finally {
    $sourceImage.Dispose()
  }
}

function New-SplashCanvas([System.Drawing.Bitmap]$logo, [int]$size, [string]$backgroundHex, [string]$textColorHex, [string]$label) {
  $canvas = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  try {
    $bg = [System.Drawing.ColorTranslator]::FromHtml($backgroundHex)
    $fg = [System.Drawing.ColorTranslator]::FromHtml($textColorHex)
    $graphics.Clear($bg)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $logoSize = [int]($size * 0.28)
    $logoX = [int](($size - $logoSize) / 2)
    $logoY = [int](($size - $logoSize) / 2) - [int]($size * 0.08)
    $graphics.DrawImage($logo, $logoX, $logoY, $logoSize, $logoSize)

    if ($label) {
      $fontSize = [int]($size * 0.045)
      $font = New-Object System.Drawing.Font("Segoe UI Semibold", $fontSize, [System.Drawing.FontStyle]::Bold)
      try {
        $brush = New-Object System.Drawing.SolidBrush($fg)
        try {
          $layout = New-Object System.Drawing.StringFormat
          $layout.Alignment = [System.Drawing.StringAlignment]::Center
          $layout.LineAlignment = [System.Drawing.StringAlignment]::Near
          $textRect = [System.Drawing.RectangleF]::new(
            [float]0,
            [float]($logoY + $logoSize + ([int]($size * 0.02))),
            [float]$size,
            [float]($fontSize * 2)
          )
          $graphics.DrawString($label, $font, $brush, $textRect, $layout)
        } finally {
          $brush.Dispose()
        }
      } finally {
        $font.Dispose()
      }
    }
    return $canvas
  } catch {
    $canvas.Dispose()
    throw
  } finally {
    $graphics.Dispose()
  }
}

$transparentIcon = New-TransparentCutout -inputPath $sourceIcon -targetSize 1024
try {
  $transparentIcon.Save((Join-Path $assetsDir "icon-only.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $transparentIcon.Save((Join-Path $assetsDir "icon-foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)

  $background = New-Object System.Drawing.Bitmap 1024, 1024, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($background)
    try {
      $graphics.Clear(([System.Drawing.ColorTranslator]::FromHtml("#12355b")))
    } finally {
      $graphics.Dispose()
    }
    $background.Save((Join-Path $assetsDir "icon-background.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $background.Dispose()
  }

  $splashLight = New-SplashCanvas -logo $transparentIcon -size 2732 -backgroundHex "#ffffff" -textColorHex "#12355b" -label "SOM PRO"
  try {
    $splashLight.Save((Join-Path $assetsDir "splash.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $splashLight.Dispose()
  }

  $splashDark = New-SplashCanvas -logo $transparentIcon -size 2732 -backgroundHex "#12355b" -textColorHex "#ffffff" -label "SOM PRO"
  try {
    $splashDark.Save((Join-Path $assetsDir "splash-dark.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $splashDark.Dispose()
  }
} finally {
  $transparentIcon.Dispose()
}

Write-Host "Mobile asset sources written to $assetsDir"
