$root = "C:\Users\vinhx\OneDrive\Desktop\Levi's App with Claude\app-store-package\www"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8321/")
$listener.Start()
Write-Output "serving $root on 8321"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = $ctx.Request.Url.LocalPath.TrimStart('/')
  if ($path -eq '') { $path = 'index.html' }
  $file = Join-Path $root $path
  if (Test-Path $file) {
    $bytes = [IO.File]::ReadAllBytes($file)
    if ($file -match '\.html$') { $ctx.Response.ContentType = 'text/html; charset=utf-8' }
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $ctx.Response.StatusCode = 404
  }
  $ctx.Response.Close()
}
