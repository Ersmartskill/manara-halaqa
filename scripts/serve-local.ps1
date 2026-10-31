# ============================================================
#  خادم محلي بسيط لتجربة منارة الحلقة على http://localhost:8787
#  الاستخدام: powershell -ExecutionPolicy Bypass -File scripts/serve-local.ps1
#  (فتح index.html مباشرة يعمل أيضًا في الوضع المحلي)
# ============================================================

param([int]$Port = 8787)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$Root = Split-Path -Parent $PSScriptRoot
$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add("http://localhost:$Port/")
$Listener.Start()

$Mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.ico'  = 'image/x-icon'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
  '.txt'  = 'text/plain; charset=utf-8'
}

Write-Host "منارة الحلقة تعمل على: http://localhost:$Port/" -ForegroundColor Green
Write-Host "اضغط Ctrl+C لإيقاف الخادم." -ForegroundColor DarkGray

while ($Listener.IsListening) {
  try {
    $Context = $Listener.GetContext()
    $Request = $Context.Request
    $Response = $Context.Response

    $Relative = [System.Uri]::UnescapeDataString($Request.Url.AbsolutePath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($Relative)) { $Relative = 'index.html' }

    $FullPath = [System.IO.Path]::GetFullPath((Join-Path $Root $Relative))
    if (-not $FullPath.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
      $Response.StatusCode = 403
      $Response.Close()
      continue
    }

    if (Test-Path -LiteralPath $FullPath -PathType Leaf) {
      $Ext = [System.IO.Path]::GetExtension($FullPath).ToLowerInvariant()
      $Type = $Mime[$Ext]
      if (-not $Type) { $Type = 'application/octet-stream' }
      $Bytes = [System.IO.File]::ReadAllBytes($FullPath)
      $Response.ContentType = $Type
      $Response.ContentLength64 = $Bytes.Length
      $Response.Headers.Add('Cache-Control', 'no-store')
      $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
    } else {
      $Response.StatusCode = 404
      $Bytes = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
      $Response.ContentType = 'text/plain; charset=utf-8'
      $Response.ContentLength64 = $Bytes.Length
      $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
    }
    $Response.Close()
  } catch {
    try { $Context.Response.StatusCode = 500; $Context.Response.Close() } catch { }
  }
}
