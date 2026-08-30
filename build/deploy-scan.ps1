# Deploy the 'scan' edge function v21 to Supabase via the Management API.
# Reads SUPABASE_ACCESS_TOKEN from the User environment scope so the token never
# appears in chat/logs. Create one at https://supabase.com/dashboard/account/tokens
$ErrorActionPreference = 'Stop'
$ref = 'czbetvehfqqfhggqlqfp'
$src = "C:\Users\vinhx\OneDrive\Desktop\Levi's App with Claude\app-store-package\backend\scan\index.ts"
$token = [Environment]::GetEnvironmentVariable('SUPABASE_ACCESS_TOKEN','User')
if (-not $token) { $token = [Environment]::GetEnvironmentVariable('SUPABASE_ACCESS_TOKEN','Process') }
if (-not $token) { Write-Output 'NOTOKEN'; exit 1 }
if (-not (Test-Path $src)) { Write-Output "NOSRC: $src"; exit 1 }
$code = [IO.File]::ReadAllText($src)
$hdr = @{ Authorization = "Bearer $token" }

# --- Attempt 1: multipart deploy endpoint (current API) ---
function Deploy-Multipart {
  $uri = "https://api.supabase.com/v1/projects/$ref/functions/deploy?slug=scan"
  $boundary = [Guid]::NewGuid().ToString()
  $LF = "`r`n"
  $metadata = '{"name":"scan","entrypoint_path":"index.ts","verify_jwt":true}'
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append("--$boundary$LF")
  [void]$sb.Append("Content-Disposition: form-data; name=`"metadata`"$LF")
  [void]$sb.Append("Content-Type: application/json$LF$LF")
  [void]$sb.Append("$metadata$LF")
  [void]$sb.Append("--$boundary$LF")
  [void]$sb.Append("Content-Disposition: form-data; name=`"file`"; filename=`"index.ts`"$LF")
  [void]$sb.Append("Content-Type: application/typescript$LF$LF")
  [void]$sb.Append("$code$LF")
  [void]$sb.Append("--$boundary--$LF")
  $body = [Text.Encoding]::UTF8.GetBytes($sb.ToString())
  return Invoke-RestMethod -Method Post -Uri $uri -Headers $hdr -ContentType "multipart/form-data; boundary=$boundary" -Body $body -TimeoutSec 120
}

# --- Attempt 2: legacy PATCH with inline body ---
function Deploy-Patch {
  $uri = "https://api.supabase.com/v1/projects/$ref/functions/scan"
  $payload = @{ name = 'scan'; body = $code; verify_jwt = $true } | ConvertTo-Json -Depth 4
  return Invoke-RestMethod -Method Patch -Uri $uri -Headers $hdr -ContentType 'application/json' -Body $payload -TimeoutSec 120
}

$ok = $false
try { $r = Deploy-Multipart; Write-Output ("DEPLOYED (multipart) version=" + $r.version); $ok = $true }
catch {
  Write-Output ("multipart failed: " + $_.Exception.Message.Substring(0,[Math]::Min(160,$_.Exception.Message.Length)))
  try { $r = Deploy-Patch; Write-Output ("DEPLOYED (patch) version=" + $r.version); $ok = $true }
  catch { Write-Output ("patch failed: " + $_.Exception.Message.Substring(0,[Math]::Min(200,$_.Exception.Message.Length))) }
}
if (-not $ok) { exit 1 }

# --- Verify ---
Start-Sleep -Seconds 3
try {
  $f = Invoke-RestMethod -Method Get -Uri "https://api.supabase.com/v1/projects/$ref/functions/scan" -Headers $hdr -TimeoutSec 60
  Write-Output ("VERIFY version=" + $f.version + " status=" + $f.status + " updated=" + $f.updated_at)
} catch { Write-Output ("verify failed: " + $_.Exception.Message.Substring(0,[Math]::Min(160,$_.Exception.Message.Length))) }
