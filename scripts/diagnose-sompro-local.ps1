param(
  [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Continue"
if (-not $ProjectRoot) { $ProjectRoot = Split-Path -Parent $PSScriptRoot }
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$LogDir = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Report = Join-Path $LogDir "sompro-local-diagnostics.txt"

function Test-Port($Port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(1000, $false)
    if ($ok) { $client.EndConnect($iar) }
    $client.Close()
    return $ok
  } catch { return $false }
}

function Add-Line($Text) {
  $Text | Tee-Object -FilePath $Report -Append
}

if (Test-Path -LiteralPath $Report) { Remove-Item -LiteralPath $Report -Force }
Add-Line "SOM PRO Local Diagnostics"
Add-Line "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Add-Line "Project: $ProjectRoot"
Add-Line ""

Add-Line "Required commands:"
Add-Line "Node: $([bool](Get-Command node -ErrorAction SilentlyContinue))"
Add-Line "npm: $([bool](Get-Command npm.cmd -ErrorAction SilentlyContinue))"
Add-Line "Docker: $([bool](Get-Command docker -ErrorAction SilentlyContinue))"

Add-Line ""
Add-Line "Ports:"
foreach ($port in 4000,4100,5432,6379) {
  Add-Line "PORT $port OPEN=$(Test-Port $port)"
}

Add-Line ""
Add-Line "Docker status:"
try {
  docker info 2>&1 | Select-Object -First 20 | ForEach-Object { Add-Line $_ }
} catch {
  Add-Line "Docker info failed: $($_.Exception.Message)"
}

Add-Line ""
Add-Line "Recent SOM PRO service log:"
$serviceLog = Join-Path $LogDir "sompro-services.log"
if (Test-Path -LiteralPath $serviceLog) {
  Get-Content -LiteralPath $serviceLog -Tail 40 | ForEach-Object { Add-Line $_ }
} else {
  Add-Line "No sompro-services.log file found."
}

Add-Line ""
Add-Line "Result file: $Report"