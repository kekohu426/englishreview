param(
  [string]$PdfPath = "C:\Users\ke'ko\Desktop\new bigfun student book 2.pdf",
  [string]$OutDir = "D:\zhishiku\00_Inbox\bigfun2_textbook_md",
  [int]$StartPage = 1,
  [int]$EndPage = 0,
  [double]$Scale = 2.5
)

$ErrorActionPreference = "Stop"
$python = "C:\Users\ke'ko\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$imageDir = Join-Path $OutDir "_page_images"
New-Item -ItemType Directory -Force -Path $OutDir, $imageDir | Out-Null

Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null

function Await-WinRt($AsyncOp, [Type]$ResultType) {
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetGenericArguments().Count -eq 1 } |
    Select-Object -First 1).MakeGenericMethod($ResultType)
  $task = $asTask.Invoke($null, @($AsyncOp))
  $task.Wait()
  return $task.Result
}

function Get-OcrText([string]$ImagePath) {
  $file = Await-WinRt ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)) ([Windows.Storage.StorageFile])
  $stream = Await-WinRt ($file.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
  $decoder = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new("en-US"))
  if ($null -eq $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
  if ($null -eq $engine) { throw "Windows OCR engine is unavailable." }
  $result = Await-WinRt ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  return $result.Text
}

$renderScript = @'
import sys
from pathlib import Path
import pypdfium2 as pdfium

pdf_path, image_dir, start, end, scale = sys.argv[1], Path(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), float(sys.argv[5])
image_dir.mkdir(parents=True, exist_ok=True)
doc = pdfium.PdfDocument(pdf_path)
page_count = len(doc)
if end <= 0 or end > page_count:
    end = page_count
print(page_count)
for page_no in range(start, end + 1):
    out = image_dir / ("page_%03d.png" % page_no)
    if not out.exists():
        page = doc[page_no - 1]
        bitmap = page.render(scale=scale, rotation=0)
        bitmap.to_pil().save(out)
        page.close()
    print(out)
'@

$renderPy = Join-Path $env:TEMP "render_bigfun_pdf_pages.py"
Set-Content -LiteralPath $renderPy -Value $renderScript -Encoding UTF8
$renderOut = & $python $renderPy $PdfPath $imageDir $StartPage $EndPage $Scale
$pageCount = [int]$renderOut[0]
$images = $renderOut | Select-Object -Skip 1

$all = New-Object System.Collections.Generic.List[string]
$all.Add("# Big Fun Student Book 2 - OCR Text")
$all.Add("")
$all.Add("- Source PDF: $PdfPath")
$all.Add("- Pages: $pageCount")
$all.Add("- OCR: Windows.Media.Ocr en-US")
$all.Add("")

foreach ($image in $images) {
  if ($image -match 'page_(\d+)\.png$') {
    $pageNo = [int]$Matches[1]
  } else {
    continue
  }
  Write-Host "OCR page $pageNo / $pageCount"
  $text = (Get-OcrText $image).Trim()
  $mdPath = Join-Path $OutDir ("page_{0:D3}.md" -f $pageNo)
  $content = @(
    "# Page $pageNo",
    "",
    "<!-- source: new bigfun student book 2.pdf; page: $pageNo; ocr: windows-media-ocr -->",
    "",
    $text
  ) -join "`n"
  Set-Content -LiteralPath $mdPath -Value $content -Encoding UTF8
  $all.Add("## Page $pageNo")
  $all.Add("")
  $all.Add($text)
  $all.Add("")
}

Set-Content -LiteralPath (Join-Path $OutDir "99_all-pages.md") -Value ($all -join "`n") -Encoding UTF8
