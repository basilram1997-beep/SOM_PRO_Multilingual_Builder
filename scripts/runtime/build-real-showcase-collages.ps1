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
    [int]$LeftTrim = 0,
    [int]$RightTrim = 0
  )

  $effectiveWidth = [Math]::Max(1, $ImageWidth - $LeftTrim - $RightTrim)
  $targetAspect = $TargetWidth / [double]$TargetHeight
  $effectiveAspect = $effectiveWidth / [double]$ImageHeight

  if ($effectiveAspect -gt $targetAspect) {
    $srcHeight = $ImageHeight
    $srcWidth = [int]([Math]::Round($ImageHeight * $targetAspect))
    $srcX = [int]([Math]::Round($LeftTrim + (($effectiveWidth - $srcWidth) / 2)))
    $srcY = 0
  } else {
    $srcWidth = $effectiveWidth
    $srcHeight = [int]([Math]::Round($effectiveWidth / $targetAspect))
    $srcX = $LeftTrim
    $srcY = 0
  }

  return [System.Drawing.Rectangle]::new($srcX, $srcY, $srcWidth, $srcHeight)
}

function New-TextFormat {
  param(
    [System.Drawing.StringAlignment]$Alignment = [System.Drawing.StringAlignment]::Far,
    [System.Drawing.StringAlignment]$LineAlignment = [System.Drawing.StringAlignment]::Near
  )

  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = $Alignment
  $format.LineAlignment = $LineAlignment
  $format.FormatFlags = [System.Drawing.StringFormatFlags]::DirectionRightToLeft
  return $format
}

function Draw-RtlText {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [System.Drawing.Font]$Font,
    [System.Drawing.Brush]$Brush,
    [System.Drawing.RectangleF]$Rect,
    [System.Drawing.StringAlignment]$Alignment = [System.Drawing.StringAlignment]::Far,
    [System.Drawing.StringAlignment]$LineAlignment = [System.Drawing.StringAlignment]::Near
  )

  $format = New-TextFormat -Alignment $Alignment -LineAlignment $LineAlignment
  try {
    $Graphics.DrawString($Text, $Font, $Brush, $Rect, $format)
  } finally {
    $format.Dispose()
  }
}

function New-BrushColor {
  param(
    [string]$Hex,
    [int]$Alpha = 255
  )

  $color = [System.Drawing.ColorTranslator]::FromHtml($Hex)
  return [System.Drawing.Color]::FromArgb($Alpha, $color.R, $color.G, $color.B)
}

function Draw-Pill {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [System.Drawing.RectangleF]$Rect,
    [System.Drawing.Color]$Fill,
    [System.Drawing.Color]$Border,
    [System.Drawing.Color]$TextColor,
    [int]$FontSize = 17
  )

  $path = New-RoundRectPath -Rect $Rect -Radius ($Rect.Height / 2)
  $fillBrush = New-Object System.Drawing.SolidBrush($Fill)
  $borderPen = New-Object System.Drawing.Pen($Border, 2)
  $textBrush = New-Object System.Drawing.SolidBrush($TextColor)
  $font = New-Object System.Drawing.Font("Tahoma", $FontSize, [System.Drawing.FontStyle]::Bold)
  try {
    $Graphics.FillPath($fillBrush, $path)
    $Graphics.DrawPath($borderPen, $path)
    Draw-RtlText -Graphics $Graphics -Text $Text -Font $font -Brush $textBrush -Rect $Rect -Alignment ([System.Drawing.StringAlignment]::Center) -LineAlignment ([System.Drawing.StringAlignment]::Center)
  } finally {
    $font.Dispose()
    $textBrush.Dispose()
    $borderPen.Dispose()
    $fillBrush.Dispose()
    $path.Dispose()
  }
}

function Draw-ImageCard {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$SourcePath,
    [System.Drawing.RectangleF]$Rect,
    [string]$Label = "لقطة حقيقية من المشروع",
    [int]$LeftTrim = 0,
    [int]$RightTrim = 260
  )

  $shadowRect = [System.Drawing.RectangleF]::new($Rect.X + 10, $Rect.Y + 14, $Rect.Width, $Rect.Height)
  $shadowPath = New-RoundRectPath -Rect $shadowRect -Radius 32
  $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(38, 0, 38, 92))
  $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
  $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(214, 212, 225, 245), 2)

  try {
    $Graphics.FillPath($shadowBrush, $shadowPath)
  } finally {
    $shadowBrush.Dispose()
    $shadowPath.Dispose()
  }

  $cardPath = New-RoundRectPath -Rect $Rect -Radius 32
  try {
    $state = $Graphics.Save()
    $Graphics.FillPath($whiteBrush, $cardPath)
    $Graphics.DrawPath($borderPen, $cardPath)
    $Graphics.SetClip($cardPath)

    $img = [System.Drawing.Image]::FromFile($SourcePath)
    try {
      $dest = [System.Drawing.Rectangle]::new([int]$Rect.X, [int]$Rect.Y, [int]$Rect.Width, [int]$Rect.Height)
      $src = Get-CropRect -ImageWidth $img.Width -ImageHeight $img.Height -TargetWidth $dest.Width -TargetHeight $dest.Height -LeftTrim $LeftTrim -RightTrim $RightTrim
      $Graphics.DrawImage($img, $dest, $src, [System.Drawing.GraphicsUnit]::Pixel)
    } finally {
      $img.Dispose()
    }
    $Graphics.Restore($state)

    $overlayRect = [System.Drawing.RectangleF]::new($Rect.X + 18, $Rect.Bottom - 70, 250, 40)
    Draw-Pill -Graphics $Graphics -Text $Label -Rect $overlayRect -Fill ([System.Drawing.Color]::FromArgb(210, 19, 37, 71)) -Border ([System.Drawing.Color]::FromArgb(255, 255, 255, 255)) -TextColor ([System.Drawing.Color]::White) -FontSize 15
  } finally {
    $whiteBrush.Dispose()
    $borderPen.Dispose()
    $cardPath.Dispose()
  }
}

function Draw-Table {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.RectangleF]$Rect,
    [string[]]$Headers,
    [object[][]]$Rows,
    [System.Drawing.Color]$Accent,
    [int]$RowHeight = 45,
    [int]$HighlightColumn = -1
  )

  $headerHeight = 52
  $headerFont = New-Object System.Drawing.Font("Tahoma", 18, [System.Drawing.FontStyle]::Bold)
  $bodyFont = New-Object System.Drawing.Font("Tahoma", 16, [System.Drawing.FontStyle]::Regular)
  $smallBold = New-Object System.Drawing.Font("Tahoma", 15, [System.Drawing.FontStyle]::Bold)
  $bgHeader = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 248, 255))
  $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(192, 205, 227), 2)
  $rowBrushA = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255))
  $rowBrushB = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 251, 255))
  $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(37, 48, 69))
  $accentBrush = New-Object System.Drawing.SolidBrush($Accent)

  try {
    $x1 = $Rect.X
    $y1 = $Rect.Y
    $x2 = $Rect.Right
    $tableWidth = $Rect.Width
    $columns = $Headers.Count
    $colWidth = $tableWidth / $columns

    $headerRect = [System.Drawing.RectangleF]::new($x1, $y1, $tableWidth, $headerHeight)
    $headerPath = New-RoundRectPath -Rect $headerRect -Radius 18
    try {
      $Graphics.FillPath($bgHeader, $headerPath)
      $Graphics.DrawPath($borderPen, $headerPath)
    } finally {
      $headerPath.Dispose()
    }

    for ($i = 0; $i -lt $columns; $i++) {
      $cx1 = $x1 + ($i * $colWidth)
      $cx2 = $cx1 + $colWidth
      if ($i -lt ($columns - 1)) {
        $Graphics.DrawLine($borderPen, $cx2, $y1, $cx2, $y1 + $headerHeight)
      }
      $cellRect = [System.Drawing.RectangleF]::new($cx1 + 6, $y1 + 4, $colWidth - 12, $headerHeight - 8)
      Draw-RtlText -Graphics $Graphics -Text $Headers[$i] -Font $headerFont -Brush $textBrush -Rect $cellRect -Alignment ([System.Drawing.StringAlignment]::Center) -LineAlignment ([System.Drawing.StringAlignment]::Center)
    }

    $rowY = $y1 + $headerHeight
    for ($r = 0; $r -lt $Rows.Count; $r++) {
      $fill = if (($r % 2) -eq 0) { $rowBrushA } else { $rowBrushB }
      $rowRect = [System.Drawing.RectangleF]::new($x1, $rowY, $tableWidth, $RowHeight)
      $Graphics.FillRectangle($fill, $rowRect)
      $Graphics.DrawRectangle($borderPen, $x1, $rowY, $tableWidth, $RowHeight)
      for ($c = 0; $c -lt $columns; $c++) {
        $cx1 = $x1 + ($c * $colWidth)
        $cx2 = $cx1 + $colWidth
        if ($c -lt ($columns - 1)) {
          $Graphics.DrawLine($borderPen, $cx2, $rowY, $cx2, $rowY + $RowHeight)
        }
        $text = [string]$Rows[$r][$c]
        $cellRect = [System.Drawing.RectangleF]::new($cx1 + 10, $rowY + 5, $colWidth - 20, $RowHeight - 10)
        if ($c -eq $HighlightColumn) {
          Draw-RtlText -Graphics $Graphics -Text $text -Font $smallBold -Brush $accentBrush -Rect $cellRect -Alignment ([System.Drawing.StringAlignment]::Center) -LineAlignment ([System.Drawing.StringAlignment]::Center)
        } else {
          Draw-RtlText -Graphics $Graphics -Text $text -Font $bodyFont -Brush $textBrush -Rect $cellRect -Alignment ([System.Drawing.StringAlignment]::Center) -LineAlignment ([System.Drawing.StringAlignment]::Center)
        }
      }
      $rowY += $RowHeight
    }
  } finally {
    $headerFont.Dispose()
    $bodyFont.Dispose()
    $smallBold.Dispose()
    $bgHeader.Dispose()
    $borderPen.Dispose()
    $rowBrushA.Dispose()
    $rowBrushB.Dispose()
    $textBrush.Dispose()
    $accentBrush.Dispose()
  }
}

function New-ShowcasePage {
  param(
    [string]$OutputName,
    [string]$SourceImage,
    [string]$Badge,
    [string]$Title,
    [string]$Subtitle,
    [string[]]$Chips,
    [string[]]$Headers,
    [object[][]]$Rows,
    [string]$Footer,
    [string]$AccentHex = "#2563eb",
    [int]$RightTrim = 260,
    [int]$LeftTrim = 0
  )

  $width = 1280
  $height = 1600
  $bitmap = New-Object System.Drawing.Bitmap($width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb))
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      ([System.Drawing.Rectangle]::new(0, 0, $width, $height)),
      (New-BrushColor "#f5f8ff"),
      (New-BrushColor "#e7eef9"),
      90
    )
    $graphics.FillRectangle($bg, 0, 0, $width, $height)
    $bg.Dispose()

    # Header band
    $bandRect = [System.Drawing.RectangleF]::new(56, 48, 1168, 132)
    $bandPath = New-RoundRectPath -Rect $bandRect -Radius 30
    $bandBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      ([System.Drawing.Rectangle]::new([int]$bandRect.X, [int]$bandRect.Y, [int]$bandRect.Width, [int]$bandRect.Height)),
      (New-BrushColor "#0b2d6b"),
      (New-BrushColor "#2d6bf4"),
      0
    )
    try {
      $graphics.FillPath($bandBrush, $bandPath)
    } finally {
      $bandBrush.Dispose()
      $bandPath.Dispose()
    }

    $titleFont = New-Object System.Drawing.Font("Tahoma", 30, [System.Drawing.FontStyle]::Bold)
    $subFont = New-Object System.Drawing.Font("Tahoma", 18, [System.Drawing.FontStyle]::Regular)
    $badgeFont = New-Object System.Drawing.Font("Tahoma", 18, [System.Drawing.FontStyle]::Bold)
    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(225, 237, 248))
    $badgeFill = New-Object System.Drawing.SolidBrush((New-BrushColor $AccentHex))
    $badgeBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220, 255, 255, 255), 2)
    try {
      $badgeRect = [System.Drawing.RectangleF]::new(86, 84, 162, 48)
      $badgePath = New-RoundRectPath -Rect $badgeRect -Radius 24
      try {
        $graphics.FillPath($badgeFill, $badgePath)
        $graphics.DrawPath($badgeBorder, $badgePath)
        Draw-RtlText -Graphics $graphics -Text $Badge -Font $badgeFont -Brush $titleBrush -Rect $badgeRect -Alignment ([System.Drawing.StringAlignment]::Center) -LineAlignment ([System.Drawing.StringAlignment]::Center)
      } finally {
        $badgePath.Dispose()
      }

      $titleRect = [System.Drawing.RectangleF]::new(280, 68, 860, 44)
      Draw-RtlText -Graphics $graphics -Text $Title -Font $titleFont -Brush $titleBrush -Rect $titleRect -Alignment ([System.Drawing.StringAlignment]::Far) -LineAlignment ([System.Drawing.StringAlignment]::Center)
      $subtitleRect = [System.Drawing.RectangleF]::new(280, 116, 860, 34)
      Draw-RtlText -Graphics $graphics -Text $Subtitle -Font $subFont -Brush $subBrush -Rect $subtitleRect -Alignment ([System.Drawing.StringAlignment]::Far) -LineAlignment ([System.Drawing.StringAlignment]::Center)
    } finally {
      $titleFont.Dispose()
      $subFont.Dispose()
      $badgeFont.Dispose()
      $titleBrush.Dispose()
      $subBrush.Dispose()
      $badgeFill.Dispose()
      $badgeBorder.Dispose()
    }

    # Main panels
    $imageRect = [System.Drawing.RectangleF]::new(58, 212, 500, 1328)
    $detailRect = [System.Drawing.RectangleF]::new(582, 212, 640, 1328)
    Draw-ImageCard -Graphics $graphics -SourcePath (Join-Path $sourceDir $SourceImage) -Rect $imageRect -Label "لقطة من داخل المشروع" -LeftTrim $LeftTrim -RightTrim $RightTrim

    $detailPath = New-RoundRectPath -Rect $detailRect -Radius 32
    $detailShadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30, 29, 56, 109))
    $detailFill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 250, 255))
    $detailBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(214, 213, 225, 243), 2)
    try {
      $shadowRect = [System.Drawing.RectangleF]::new($detailRect.X + 10, $detailRect.Y + 16, $detailRect.Width, $detailRect.Height)
      $shadowPath = New-RoundRectPath -Rect $shadowRect -Radius 32
      try {
        $graphics.FillPath($detailShadow, $shadowPath)
      } finally {
        $shadowPath.Dispose()
      }
      $graphics.FillPath($detailFill, $detailPath)
      $graphics.DrawPath($detailBorder, $detailPath)
    } finally {
      $detailShadow.Dispose()
      $detailFill.Dispose()
      $detailBorder.Dispose()
      $detailPath.Dispose()
    }

    $accent = [System.Drawing.ColorTranslator]::FromHtml($AccentHex)
    $dark = New-BrushColor "#1f355f"
    $muted = New-BrushColor "#65748b"
    $white = [System.Drawing.Color]::White

    $dTitleFont = New-Object System.Drawing.Font("Tahoma", 28, [System.Drawing.FontStyle]::Bold)
    $dSubFont = New-Object System.Drawing.Font("Tahoma", 17, [System.Drawing.FontStyle]::Regular)
    $sectionFont = New-Object System.Drawing.Font("Tahoma", 16, [System.Drawing.FontStyle]::Bold)
    $footerFont = New-Object System.Drawing.Font("Tahoma", 15, [System.Drawing.FontStyle]::Bold)
    $chFont = New-Object System.Drawing.Font("Tahoma", 15, [System.Drawing.FontStyle]::Bold)
    $dTitleBrush = New-Object System.Drawing.SolidBrush($dark)
    $dSubBrush = New-Object System.Drawing.SolidBrush($muted)
    $sectionBrush = New-Object System.Drawing.SolidBrush($accent)
    $footerFill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(232, 43, 107, 234))
    $footerBrush = New-Object System.Drawing.SolidBrush($white)
    try {
      $graphics.DrawString($Title, $dTitleFont, $dTitleBrush, [System.Drawing.RectangleF]::new($detailRect.X + 30, $detailRect.Y + 34, $detailRect.Width - 60, 40), (New-TextFormat))
      $graphics.DrawString($Subtitle, $dSubFont, $dSubBrush, [System.Drawing.RectangleF]::new($detailRect.X + 30, $detailRect.Y + 84, $detailRect.Width - 60, 66), (New-TextFormat))

      # chips row
      $chipCount = [Math]::Max(1, $Chips.Count)
      $chipGap = 12
      $chipTop = $detailRect.Y + 172
      $chipWidth = [int](([Math]::Floor(($detailRect.Width - 60 - (($chipCount - 1) * $chipGap)) / $chipCount)))
      for ($i = 0; $i -lt $chipCount; $i++) {
        $chipText = $Chips[$i]
        $chipX = $detailRect.X + 30 + ($i * ($chipWidth + $chipGap))
        $chipRect = [System.Drawing.RectangleF]::new($chipX, $chipTop, $chipWidth, 44)
        Draw-Pill -Graphics $graphics -Text $chipText -Rect $chipRect -Fill ([System.Drawing.Color]::FromArgb(24, $accent.R, $accent.G, $accent.B)) -Border ([System.Drawing.Color]::FromArgb(120, $accent.R, $accent.G, $accent.B)) -TextColor $accent -FontSize 15
      }

      $tableTitleRect = [System.Drawing.RectangleF]::new($detailRect.X + 30, $detailRect.Y + 242, $detailRect.Width - 60, 26)
      Draw-RtlText -Graphics $graphics -Text "بيانات تجريبية مرتبة" -Font $sectionFont -Brush $sectionBrush -Rect $tableTitleRect -Alignment ([System.Drawing.StringAlignment]::Far) -LineAlignment ([System.Drawing.StringAlignment]::Center)

      $tableRect = [System.Drawing.RectangleF]::new($detailRect.X + 30, $detailRect.Y + 284, $detailRect.Width - 60, 282)
      Draw-Table -Graphics $graphics -Rect $tableRect -Headers $Headers -Rows $Rows -Accent $accent -RowHeight 45 -HighlightColumn ($Headers.Count - 1)

      $footerRect = [System.Drawing.RectangleF]::new($detailRect.X + 30, $detailRect.Bottom - 132, $detailRect.Width - 60, 96)
      $footerPath = New-RoundRectPath -Rect $footerRect -Radius 22
      try {
        $graphics.FillPath($footerFill, $footerPath)
      } finally {
        $footerPath.Dispose()
      }
      Draw-RtlText -Graphics $graphics -Text $Footer -Font $footerFont -Brush $footerBrush -Rect $footerRect -Alignment ([System.Drawing.StringAlignment]::Center) -LineAlignment ([System.Drawing.StringAlignment]::Center)
    } finally {
      $dTitleFont.Dispose()
      $dSubFont.Dispose()
      $sectionFont.Dispose()
      $footerFont.Dispose()
      $chFont.Dispose()
      $dTitleBrush.Dispose()
      $dSubBrush.Dispose()
      $sectionBrush.Dispose()
      $footerFill.Dispose()
      $footerBrush.Dispose()
    }

    $outPath = Join-Path $outputDir $OutputName
    $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Saved $outPath"
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$pages = @(
  @{
    OutputName = "student-homework-v1.png"
    SourceImage = "05-homework.png"
    Badge = "الطالب"
    Title = "واجباتي"
    Subtitle = "شاشة الطالب تعرض الواجبات المستحقة مع الموعد والحالة والتقدّم."
    Chips = @("4 واجبات", "2 منجزة", "1 اليوم")
    Headers = @("المادة", "الواجب", "الموعد", "الحالة")
    Rows = @(
      @("الرياضيات", "حل صفحة 41", "اليوم", "مفتوح"),
      @("العربية", "تلخيص الدرس 3", "غدًا", "متاح"),
      @("العلوم", "نشاط عملي", "الإثنين", "جاهز"),
      @("الإنجليزية", "مفردات الوحدة", "الأربعاء", "مضاف")
    )
    Footer = "كل البيانات الظاهرة هنا تجريبية داخل الصورة فقط وليست محفوظة في قاعدة البيانات."
    AccentHex = "#2563eb"
    RightTrim = 260
  },
  @{
    OutputName = "student-lessons-v1.png"
    SourceImage = "04-lesson-today.png"
    Badge = "الطالب"
    Title = "دروسي"
    Subtitle = "لقطة توضّح الدروس التي يمرّ بها الطالب خلال يومه الدراسي."
    Chips = @("5 دروس", "2 مراجعة", "1 مختبر")
    Headers = @("الحصة", "المادة", "المعلم", "الوقت")
    Rows = @(
      @("1", "رياضيات", "أ. ناصر", "08:00"),
      @("2", "عربية", "أ. ريم", "08:45"),
      @("3", "علوم", "أ. سامر", "09:30"),
      @("4", "حاسوب", "أ. ليلى", "10:15")
    )
    Footer = "الدروس تظهر مرتبة حسب اليوم مع ربط سريع بالمادة والمعلم والوقت."
    AccentHex = "#0f9d75"
    RightTrim = 240
  },
  @{
    OutputName = "student-exams-v1.png"
    SourceImage = "06-exams.png"
    Badge = "الطالب"
    Title = "امتحاناتي"
    Subtitle = "مخطط واضح لامتحانات الطالب مع التاريخ والنوع والحالة الحالية."
    Chips = @("3 امتحانات", "1 اليوم", "2 جاهز")
    Headers = @("المادة", "التاريخ", "النوع", "الحالة")
    Rows = @(
      @("رياضيات", "28/08", "قصير", "اليوم"),
      @("عربية", "30/08", "شهري", "جاهز"),
      @("علوم", "02/09", "تدريبي", "لاحقًا")
    )
    Footer = "يمتلك الطالب هنا صورة مباشرة لما هو قادم في الامتحانات دون تشويش بصري."
    AccentHex = "#7c3aed"
    RightTrim = 260
  },
  @{
    OutputName = "student-program-v1.png"
    SourceImage = "11-timetable.png"
    Badge = "الطالب"
    Title = "برنامجي"
    Subtitle = "البرنامج اليومي للطالب مع الحصص والمواد والمعلمين والزمن."
    Chips = @("8 حصص", "4 مواد", "2 فراغ")
    Headers = @("الحصة", "المادة", "المعلم", "الوقت")
    Rows = @(
      @("1", "عربية", "أ. ريم", "08:00"),
      @("2", "رياضيات", "أ. ناصر", "08:45"),
      @("3", "علوم", "أ. سامر", "09:30"),
      @("4", "اجتماعيات", "أ. يزن", "10:15")
    )
    Footer = "البرنامج يظهر اليوم الدراسي بطريقة مختصرة تسهّل على الطالب معرفة كل خطوة."
    AccentHex = "#1744a3"
    RightTrim = 260
  },
  @{
    OutputName = "teacher-program-v1.png"
    SourceImage = "03-daily-program.png"
    Badge = "المعلم"
    Title = "برنامج المعلم"
    Subtitle = "واجهة المعلم تعرض حصصه اليوم وتوزيع الصفوف والتحضير والمواعيد."
    Chips = @("6 حصص", "2 تحضير", "1 مناوبة")
    Headers = @("الحصة", "الصف", "المادة", "الوقت")
    Rows = @(
      @("1", "6/أ", "رياضيات", "08:00"),
      @("2", "6/ب", "علوم", "08:45"),
      @("3", "7/أ", "عربية", "09:30"),
      @("4", "8/أ", "تربية", "10:15")
    )
    Footer = "كل ما يحتاجه المعلم في اليوم يظهر في صف واحد واضح وسريع القراءة."
    AccentHex = "#0f9d75"
    RightTrim = 240
  },
  @{
    OutputName = "teacher-substitutions-v1.png"
    SourceImage = "03-daily-program.png"
    Badge = "المعلم"
    Title = "مناوبتي"
    Subtitle = "البدائل والمناوبات المعتمدة مع الصف والحصة الأصلية والبديل."
    Chips = @("3 بدائل", "2 مؤكدة", "1 متأجل")
    Headers = @("الفترة", "الصف", "الأصلية", "البديل")
    Rows = @(
      @("1", "6/ب", "أ. خالد", "أ. ريم"),
      @("2", "7/أ", "أ. منى", "أ. سارة"),
      @("3", "8/ب", "أ. حسام", "أ. نادر")
    )
    Footer = "المناوبات تظهر بلحظة واحدة بدل البحث داخل صفحات متعددة أو سجلات طويلة."
    AccentHex = "#d97706"
    RightTrim = 240
  },
  @{
    OutputName = "teacher-grades-v1.png"
    SourceImage = "09-grades.png"
    Badge = "المعلم"
    Title = "إدخال العلامات"
    Subtitle = "صفحة إدخال العلامات تعرض الطلاب ودرجاتهم والتقدير والملاحظة."
    Chips = @("25 طالبًا", "4 مواد", "1 حفظ")
    Headers = @("الطالب", "العلامة", "التقدير", "الملاحظة")
    Rows = @(
      @("سارة محمد", "95", "ممتاز", "حفظ"),
      @("خالد علي", "88", "جيد جدًا", "مراجعة"),
      @("لينا أحمد", "91", "ممتاز", "مثبت"),
      @("يوسف محمود", "77", "جيد", "متابعة")
    )
    Footer = "الإدخال هنا تجريبي داخل الصورة فقط ليظهر كيف تبدو صفحة العمل اليومية."
    AccentHex = "#2563eb"
    RightTrim = 240
  },
  @{
    OutputName = "teacher-behavior-v1.png"
    SourceImage = "08-behavior.png"
    Badge = "المعلم"
    Title = "إدخال السلوك"
    Subtitle = "تسجيل السلوك الإيجابي أو السلبي مع التاريخ والإجراء والمتابعة."
    Chips = @("6 سجلات", "4 إيجابي", "2 متابعة")
    Headers = @("الطالب", "السلوك", "التاريخ", "الإجراء")
    Rows = @(
      @("أحمد", "التزام", "24/08", "إيجابي"),
      @("مريم", "تأخر", "24/08", "تنبيه"),
      @("عمر", "مشاركة", "24/08", "إيجابي"),
      @("سلمى", "نسيان واجب", "24/08", "متابعة")
    )
    Footer = "الملاحظات السلوكية معروضة بشكل مرتب حتى يفهمها المعلم بسرعة."
    AccentHex = "#ef4444"
    RightTrim = 240
  },
  @{
    OutputName = "teacher-exam-v1.png"
    SourceImage = "06-exams.png"
    Badge = "المعلم"
    Title = "إدخال امتحان"
    Subtitle = "إنشاء امتحان جديد مع ربطه بالصف والمادة والحالة النهائية."
    Chips = @("نموذج جاهز", "2 صفوف", "1 اليوم")
    Headers = @("الصف", "المادة", "النوع", "الحالة")
    Rows = @(
      @("6/أ", "رياضيات", "قصير", "اليوم"),
      @("6/ب", "علوم", "شهري", "جاهز"),
      @("7/أ", "عربية", "تحريري", "مجدول")
    )
    Footer = "المعلم يرى صورة واضحة لما سيُدخل قبل الحفظ أو الإرسال النهائي."
    AccentHex = "#7c3aed"
    RightTrim = 260
  },
  @{
    OutputName = "admin-free-slot-v1.png"
    SourceImage = "02-dashboard.png"
    Badge = "المدير"
    Title = "برنامج الفراغ"
    Subtitle = "يعرض من هو متفرغ وبأي حصة، مع حالة السدّ والاستدعاء والبديل."
    Chips = @("4 متفرغين", "2 حصة شاغرة", "3 استدعاءات")
    Headers = @("المعلم", "اليوم", "الحصة", "الحالة")
    Rows = @(
      @("أ. خالد", "اليوم", "3", "متفرغ"),
      @("أ. ريم", "اليوم", "4", "متفرغة"),
      @("أ. سامر", "غدًا", "2", "متفرغ"),
      @("أ. يزن", "الخميس", "5", "متاح")
    )
    Footer = "المدير يرى الفُرَغ فورًا ويعرف أين يحتاج إلى سدّ أو استدعاء أو بديل."
    AccentHex = "#f59e0b"
    RightTrim = 260
  }
)

foreach ($page in $pages) {
  New-ShowcasePage @page
}
