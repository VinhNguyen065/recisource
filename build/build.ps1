$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$proj="C:\Users\vinhx\OneDrive\Desktop\Levi's App with Claude"
$sp="C:\Users\vinhx\AppData\Local\Temp\claude\C--Users-vinhx-OneDrive-Desktop-Levi-s-App-with-Claude\3dc4430e-95ef-4167-af98-8078bfac6874\scratchpad\build"

function Compress-ToBase64([string]$path,[int]$maxW,[long]$quality,[bool]$isPng){
  $img=[System.Drawing.Image]::FromFile($path)
  try{
    $w=$img.Width;$h=$img.Height
    if($w -gt $maxW){$h=[int]($h*$maxW/$w);$w=$maxW}
    $bmp=New-Object System.Drawing.Bitmap($w,$h)
    $g=[System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode='HighQualityBicubic'
    $g.DrawImage($img,0,0,$w,$h)
    $g.Dispose()
    $ms=New-Object System.IO.MemoryStream
    if($isPng){
      $bmp.Save($ms,[System.Drawing.Imaging.ImageFormat]::Png)
      $mime='image/png'
    } else {
      $enc=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object {$_.MimeType -eq 'image/jpeg'}
      $ep=New-Object System.Drawing.Imaging.EncoderParameters(1)
      $ep.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,$quality)
      $bmp.Save($ms,$enc,$ep)
      $mime='image/jpeg'
    }
    $bmp.Dispose()
    $b64=[Convert]::ToBase64String($ms.ToArray())
    $ms.Dispose()
    return "data:$mime;base64,$b64"
  } finally { $img.Dispose() }
}

$html=[IO.File]::ReadAllText("$proj\Thermal Kitchen.dc.html")

# collect referenced image paths from the HTML (public/... jpgs + logo)
$paths=[regex]::Matches($html,"public/assets/images/[a-z\-]+/[a-z\-0-9]+\.jpg") | ForEach-Object {$_.Value} | Sort-Object -Unique
Write-Output ("unique jpgs referenced: " + $paths.Count)
$sb=New-Object System.Text.StringBuilder($html)
$total=0
foreach($p in $paths){
  $file=Join-Path $proj ($p -replace '/','\')
  if(!(Test-Path $file)){ Write-Output "MISSING: $p"; continue }
  $uri=Compress-ToBase64 $file 700 55 $false
  $total+=$uri.Length
  $null=$sb.Replace($p,$uri)
}
$logoUri=Compress-ToBase64 "$proj\assets\logo-mark.png" 160 90 $true
$null=$sb.Replace("assets/logo-mark.png",$logoUri)
$html=$sb.ToString()

# strip outer document skeleton FIRST (artifact host provides it) — before any inlined
# code can introduce stray '<body>' strings
$html=$html -replace '(?s)^.*?<body>',''
$html=$html -replace '(?s)</body>\s*</html>\s*$',''

# inline runtime scripts as base64+eval so their contents can never confuse the
# HTML parser (support.js contains literal '<script' strings that end a plain
# inline script block early)
function JsB64([string]$path){
  $code=[IO.File]::ReadAllText($path)
  $b64=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($code))
  return "<script>(0,eval)(decodeURIComponent(escape(atob(`"$b64`"))));</script>"
}
$inline=(JsB64 "$sp\react.js")+"`n"+(JsB64 "$sp\react-dom.js")+"`n"+(JsB64 "$proj\image-slot.js")+"`n"+(JsB64 "$proj\support.js")
$html=$html.Replace('<script src="image-slot.js"></script>','')
$html="$inline`n$html"

# full document skeleton with mobile viewport (target is GitHub Pages, served raw).
# The loader div streams in before the ~2.5MB of inline script, so users see
# feedback immediately instead of a white page; the app removes it on boot.
$head='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>21again</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"></head><body style="margin:0"><div id="rs-loader" style="position:fixed;inset:0;background:#F7F1E8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:system-ui,sans-serif;z-index:9999"><div style="width:44px;height:44px;border-radius:12px;background:#A83E1C;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;color:#ffffff">21</div><div style="font-weight:800;color:#17191D;font-size:15px">21again</div><div style="color:#83868C;font-size:12.5px">Loading your kitchen…</div><div style="width:120px;height:4px;border-radius:99px;background:#E8DCC6;overflow:hidden"><div style="width:40%;height:100%;border-radius:99px;background:#A83E1C;animation:rsld 1.1s ease-in-out infinite alternate"></div></div><style>@keyframes rsld{from{margin-left:0}to{margin-left:72px}}</style></div>'
$tail='<script>(function(){var f=function(){var l=document.getElementById("rs-loader");if(l)l.remove();};if(document.readyState==="complete")f();else window.addEventListener("load",f);})();</script>'
$html="$head`n$html`n$tail`n</body></html>"

$ver=(Get-Date -Format 'yyyyMMdd.HHmm')
$html=$html.Replace('__BUILD_TS__',$ver)
[IO.File]::WriteAllText("$sp\app-21.html",$html)
[IO.File]::WriteAllText("$sp\version.json",('{"v":"'+$ver+'"}'))
Write-Output ("version: " + $ver)
Write-Output ("image bytes (b64): " + $total)
Write-Output ("final size: " + (Get-Item "$sp\app-21.html").Length)
