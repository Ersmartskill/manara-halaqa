# ============================================================
#  نشر منارة الحلقة على GitHub + GitHub Pages
#  الاستخدام:
#    1) انسخ .env.example إلى .env واملأ GITHUB_TOKEN
#    2) powershell -ExecutionPolicy Bypass -File scripts/deploy-github.ps1
#  ملاحظة: ملف .env لا يُرفع إلى المستودع إطلاقًا.
# ============================================================

param(
  [string]$RepoName = '',
  [ValidateSet('public', 'private')][string]$Visibility = ''
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $ProjectRoot '.env'

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "لم أجد ملف .env. انسخ .env.example إلى .env ثم ضع GITHUB_TOKEN داخله."
}

# ---------- قراءة .env ----------
$Config = @{}
Get-Content -LiteralPath $EnvFile -Encoding UTF8 | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) { return }
  $idx = $line.IndexOf('=')
  if ($idx -lt 1) { return }
  $key = $line.Substring(0, $idx).Trim()
  $value = $line.Substring($idx + 1).Trim()
  if ($value.Length -ge 2) {
    $first = $value.Substring(0, 1)
    $last = $value.Substring($value.Length - 1, 1)
    if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
      $value = $value.Substring(1, $value.Length - 2)
    }
  }
  $Config[$key] = $value
}

$Token = $Config['GITHUB_TOKEN']
if ([string]::IsNullOrWhiteSpace($Token)) {
  throw "GITHUB_TOKEN فارغ. ضع رمز GitHub داخل ملف .env ثم أعد المحاولة."
}

if ([string]::IsNullOrWhiteSpace($RepoName)) {
  $RepoName = if ($Config['GITHUB_REPO']) { $Config['GITHUB_REPO'] } else { 'manara-halaqa' }
}
if ([string]::IsNullOrWhiteSpace($Visibility)) {
  $Visibility = if ($Config['GITHUB_VISIBILITY']) { $Config['GITHUB_VISIBILITY'] } else { 'public' }
}
if ($Visibility -notin @('public', 'private')) {
  throw "GITHUB_VISIBILITY يجب أن تكون public أو private."
}

$Headers = @{
  Authorization          = "Bearer $Token"
  Accept                 = 'application/vnd.github+json'
  'User-Agent'           = 'manara-halaqa-deploy'
  'X-GitHub-Api-Version' = '2022-11-28'
}

function Invoke-GitHub {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Uri,
    $Body = $null
  )

  $params = @{
    Method  = $Method
    Uri     = $Uri
    Headers = $Headers
  }
  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
    $params.ContentType = 'application/json; charset=utf-8'
  }

  try {
    return Invoke-RestMethod @params
  } catch {
    $response = $_.Exception.Response
    if ($null -ne $response) {
      $status = [int]$response.StatusCode
      if ($status -eq 404) { return $null }
      $detail = ''
      try {
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
        $detail = $reader.ReadToEnd()
        $reader.Close()
      } catch { }
      throw "GitHub API ($Method $Uri) فشل بالرمز $status. $detail"
    }
    throw
  }
}

function Encode-Path([string]$Path) {
  return (($Path -split '/') | ForEach-Object { [uri]::EscapeDataString($_) }) -join '/'
}

function Get-GitBlobSha([string]$Path) {
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $header = [System.Text.Encoding]::ASCII.GetBytes("blob $($bytes.Length)`0")
  $payload = New-Object byte[] ($header.Length + $bytes.Length)
  [Array]::Copy($header, 0, $payload, 0, $header.Length)
  [Array]::Copy($bytes, 0, $payload, $header.Length, $bytes.Length)
  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  try {
    $hash = $sha1.ComputeHash($payload)
  } finally {
    $sha1.Dispose()
  }
  return (($hash | ForEach-Object { $_.ToString('x2') }) -join '')
}

Write-Host "→ التحقق من حساب GitHub..." -ForegroundColor Cyan
$Me = Invoke-GitHub -Method 'GET' -Uri 'https://api.github.com/user'
if (-not $Me -or -not $Me.login) { throw "تعذر التحقق من رمز GitHub." }

$Owner = if ($Config['GITHUB_OWNER']) { $Config['GITHUB_OWNER'] } else { $Me.login }
Write-Host "  الحساب: $Owner" -ForegroundColor DarkGray

$RepoUri = "https://api.github.com/repos/$Owner/$RepoName"
$Repo = Invoke-GitHub -Method 'GET' -Uri $RepoUri

if (-not $Repo) {
  Write-Host "→ إنشاء المستودع $Owner/$RepoName ($Visibility)..." -ForegroundColor Cyan
  $CreateBody = @{
    name        = $RepoName
    description = 'منارة الحلقة — سجل إنجاز طلاب حلقة المنارة المتقدمة في حلقات جامع الراجحي'
    private     = ($Visibility -eq 'private')
    auto_init   = $true
  }
  $CreateUri = if ($Owner -eq $Me.login) {
    'https://api.github.com/user/repos'
  } else {
    "https://api.github.com/orgs/$Owner/repos"
  }
  $Repo = Invoke-GitHub -Method 'POST' -Uri $CreateUri -Body $CreateBody
} else {
  Write-Host "→ المستودع موجود مسبقًا، سيتم تحديث ملفاته." -ForegroundColor Cyan
}

$Branch = if ($Config['GITHUB_BRANCH']) { $Config['GITHUB_BRANCH'] } else { $Repo.default_branch }
if ([string]::IsNullOrWhiteSpace($Branch)) { $Branch = 'main' }

Write-Host "→ رفع الملفات إلى الفرع $Branch..." -ForegroundColor Cyan

$SkipNames = @('.env', 'Thumbs.db', '.DS_Store')
$SkipPrefixes = @('.git\', 'node_modules\', 'backups\', 'supabase\.temp\', 'supabase\.branches\')

$Files = Get-ChildItem -LiteralPath $ProjectRoot -Recurse -File -Force | Where-Object {
  $rel = $_.FullName.Substring($ProjectRoot.Length).TrimStart('\', '/')
  if ($SkipNames -contains $_.Name) { return $false }
  if ($_.Name -like '.env.*' -and $_.Name -ne '.env.example') { return $false }
  if ($_.Name -match '\.(bak|tmp)$') { return $false }
  foreach ($prefix in $SkipPrefixes) {
    if ($rel.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) { return $false }
  }
  return $true
}

$Count = 0
foreach ($file in $Files) {
  $rel = $file.FullName.Substring($ProjectRoot.Length).TrimStart('\', '/').Replace('\', '/')
  $encoded = Encode-Path $rel
  $existing = Invoke-GitHub -Method 'GET' -Uri "$RepoUri/contents/$encoded`?ref=$([uri]::EscapeDataString($Branch))"

  $localSha = Get-GitBlobSha $file.FullName
  if ($existing -and $existing.sha -eq $localSha) {
    Write-Host "  = $rel (بدون تغيير)" -ForegroundColor DarkGray
    continue
  }

  $body = @{
    message = "نشر منارة الحلقة: $rel"
    content = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($file.FullName))
    branch  = $Branch
  }
  if ($existing -and $existing.sha) { $body.sha = $existing.sha }

  Invoke-GitHub -Method 'PUT' -Uri "$RepoUri/contents/$encoded" -Body $body | Out-Null
  $Count += 1
  Write-Host "  ✓ $rel" -ForegroundColor DarkGray
}

Write-Host "  تم رفع $Count ملفًا." -ForegroundColor Green

Write-Host "→ تفعيل GitHub Pages..." -ForegroundColor Cyan
$PagesUri = "$RepoUri/pages"
$PagesBody = @{ source = @{ branch = $Branch; path = '/' } }
$Pages = Invoke-GitHub -Method 'GET' -Uri $PagesUri

if ($Pages) {
  try {
    $Pages = Invoke-GitHub -Method 'PUT' -Uri $PagesUri -Body $PagesBody
  } catch {
    Write-Warning "تعذر تحديث إعداد Pages تلقائيًا: $($_.Exception.Message)"
  }
} else {
  try {
    $Pages = Invoke-GitHub -Method 'POST' -Uri $PagesUri -Body $PagesBody
  } catch {
    Write-Warning "تعذر تفعيل Pages تلقائيًا. فعّله يدويًا من Settings > Pages. $($_.Exception.Message)"
  }
}

$SiteUrl = if ($Pages -and $Pages.html_url) { $Pages.html_url } else { "https://$Owner.github.io/$RepoName/" }

Write-Host ""
Write-Host "تم النشر بنجاح." -ForegroundColor Green
Write-Host "المستودع: https://github.com/$Owner/$RepoName" -ForegroundColor White
Write-Host "الموقع:   $SiteUrl" -ForegroundColor White
Write-Host ""
Write-Host "قد يستغرق GitHub Pages دقيقة أو دقيقتين حتى يظهر الموقع لأول مرة." -ForegroundColor Yellow
Write-Host "بعد ظهور الموقع، افتحه وسجّل الدخول بالحساب التجريبي، أو اربطه بـ Supabase من js/config.js." -ForegroundColor Yellow
