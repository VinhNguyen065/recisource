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
$head='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>21again</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"></head><body style="margin:0;overflow-x:hidden"><div id="rs-loader" style="position:fixed;inset:0;background:#F1EEFB;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:system-ui,sans-serif;z-index:9999"><div style="width:44px;height:44px;border-radius:12px;background:#EC4899;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;color:#ffffff">21</div><div style="font-weight:800;color:#241F35;font-size:15px">21again</div><div style="color:#83868C;font-size:12.5px">Loading your kitchen…</div><div style="width:120px;height:4px;border-radius:99px;background:#E9E5F5;overflow:hidden"><div style="width:40%;height:100%;border-radius:99px;background:#EC4899;animation:rsld 1.1s ease-in-out infinite alternate"></div></div><style>@keyframes rsld{from{margin-left:0}to{margin-left:72px}}</style></div>'
$tail='<script>(function(){var f=function(){var l=document.getElementById("rs-loader");if(l)l.remove();};if(document.readyState==="complete")f();else window.addEventListener("load",f);})();</script>'
# Service worker: web-only (skipped in the native app), network-first so updates apply instantly + offline fallback.
$tail=$tail+'<script>(function(){if(!("serviceWorker" in navigator)||window.Capacitor||location.protocol.indexOf("http")!==0)return;var hadCtrl=!!navigator.serviceWorker.controller,reloaded=false;navigator.serviceWorker.addEventListener("controllerchange",function(){if(reloaded||!hadCtrl)return;reloaded=true;location.reload();});navigator.serviceWorker.register("sw.js").then(function(reg){try{reg.update();}catch(e){}}).catch(function(){});})();</script>'
$html="$head`n$html`n$tail`n</body></html>"

$ver=(Get-Date -Format 'yyyyMMdd.HHmm')
$html=$html.Replace('__BUILD_TS__',$ver)
[IO.File]::WriteAllText("$sp\app-21.html",$html)
[IO.File]::WriteAllText("$sp\version.json",('{"v":"'+$ver+'"}'))
# Service worker (cache name stamped with build version → every deploy = a fresh SW that activates immediately)
$swjs=@'
const V='21-__VER__';
self.addEventListener('install',function(e){self.skipWaiting();e.waitUntil(caches.open(V).then(function(c){return c.addAll(['./','./index.html','./version.json']).catch(function(){});}));});
self.addEventListener('activate',function(e){e.waitUntil((async function(){try{var ks=await caches.keys();await Promise.all(ks.map(function(k){return k!==V?caches.delete(k):Promise.resolve();}));}catch(_e){}try{await self.clients.claim();}catch(_e){}})());});
self.addEventListener('fetch',function(e){var req=e.request;if(req.method!=='GET')return;var url;try{url=new URL(req.url);}catch(_e){return;}if(url.origin!==self.location.origin)return;e.respondWith((async function(){try{var net=await fetch(req);try{var c=await caches.open(V);c.put(req,net.clone());}catch(_e){}return net;}catch(err){var cached=await caches.match(req);return cached||caches.match('./index.html');}})());});
'@
$swjs=$swjs.Replace('__VER__',$ver)
[IO.File]::WriteAllText("$sp\sw.js",$swjs)
Write-Output ("version: " + $ver)
Write-Output ("image bytes (b64): " + $total)
Write-Output ("final size: " + (Get-Item "$sp\app-21.html").Length)
