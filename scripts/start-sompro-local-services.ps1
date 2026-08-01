param(
  [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

function Normalize-ProjectRoot {
  param([string]$Path)

  if ([string]::IsNullOrWhiteSpace($Path)) {
    throw "ProjectRoot is empty."
  }

  $clean = $Path.Trim()
  $clean = $clean.Trim('"')
  $clean = $clean.Trim("'")
  $clean = $clean -replace "[`r`n`t]", ""
  $clean = $clean.Trim()

  if ([string]::IsNullOrWhiteSpace($clean)) {
    throw "ProjectRoot is empty after normalization."
  }

  $resolved = Resolve-Path -LiteralPath $clean -ErrorAction Stop
  return $resolved.Path
}

try {
  if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = Join-Path -Path $PSScriptRoot -ChildPath ".."
  }
  $ProjectRoot = Normalize-ProjectRoot $ProjectRoot
  if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    throw "ProjectRoot does not exist: $ProjectRoot"
  }
} catch {
  Write-Host "SOM PRO startup failed: invalid ProjectRoot. $($_.Exception.Message)"
  exit 1
}

$LogDir = Join-Path -Path $ProjectRoot -ChildPath "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$ServiceLog = Join-Path -Path $LogDir -ChildPath 'sompro-services.log'

function Write-ServiceLog($Message) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Add-Content -LiteralPath $ServiceLog -Value $line
}

function Test-Port($Port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(800, $false)
    if ($ok) { $client.EndConnect($iar) }
    $client.Close()
    return $ok
  } catch { return $false }
}

function Wait-Port($Port, $Seconds) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Port $Port) { return $true }
    Start-Sleep -Seconds 2
  }
  return (Test-Port $Port)
}

function Test-DockerReady {
  try {
    $p = Start-Process -FilePath 'docker' -ArgumentList @('info') -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $LogDir 'docker-info.out.log') -RedirectStandardError (Join-Path $LogDir 'docker-info.err.log') -PassThru -Wait
    return $p.ExitCode -eq 0
  } catch { return $false }
}

function Ensure-DockerReady {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-ServiceLog 'Docker command was not found. PostgreSQL and Redis cannot start.'
    return $false
  }

  if (Test-DockerReady) { return $true }

  $dockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  if (Test-Path -LiteralPath $dockerDesktop) {
    Write-ServiceLog 'Starting Docker Desktop.'
    Start-Process -FilePath $dockerDesktop -WindowStyle Hidden | Out-Null
  } else {
    Write-ServiceLog 'Docker Desktop executable was not found.'
  }

  $deadline = (Get-Date).AddSeconds(180)
  while ((Get-Date) -lt $deadline) {
    if (Test-DockerReady) {
      Write-ServiceLog 'Docker daemon is ready.'
      return $true
    }
    Start-Sleep -Seconds 3
  }

  Write-ServiceLog 'Docker daemon did not become ready in time.'
  return $false
}

function Start-HiddenNpm([string[]]$NpmArgs, $OutName, $ErrName) {
  $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npmCommand) { throw "npm.cmd was not found" }
  if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) { throw "Working directory is invalid: $ProjectRoot" }
  $process = Start-Process -FilePath $npmCommand.Source -ArgumentList $NpmArgs -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $LogDir $OutName) -RedirectStandardError (Join-Path $LogDir $ErrName) -PassThru
  Write-ServiceLog "Started npm $($NpmArgs -join ' ') PID=$($process.Id)"
  return $process
}

function Run-NpmWait([string[]]$NpmArgs, $OutName, $ErrName) {
  $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npmCommand) { throw "npm.cmd was not found" }
  if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) { throw "Working directory is invalid: $ProjectRoot" }
  $process = Start-Process -FilePath $npmCommand.Source -ArgumentList $NpmArgs -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $LogDir $OutName) -RedirectStandardError (Join-Path $LogDir $ErrName) -PassThru -Wait
  Write-ServiceLog "Finished npm $($NpmArgs -join ' ') ExitCode=$($process.ExitCode)"
  return $process.ExitCode -eq 0
}

try {
  Set-Location -LiteralPath $ProjectRoot
  Write-ServiceLog 'SOM PRO local services startup requested.'
  Write-ServiceLog "ProjectRoot=$ProjectRoot"

  if (Ensure-DockerReady) {
    Write-ServiceLog 'Starting PostgreSQL and Redis containers.'
    Start-Process -FilePath 'docker' -ArgumentList @('compose','up','-d','postgres','redis') -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $LogDir 'docker-services.out.log') -RedirectStandardError (Join-Path $LogDir 'docker-services.err.log') -Wait | Out-Null
    $postgresReady = Wait-Port 5432 120
    $redisReady = Wait-Port 6379 60
    Write-ServiceLog "PostgreSQL ready=$postgresReady Redis ready=$redisReady"
  } else {
    $postgresReady = Test-Port 5432
    $redisReady = Test-Port 6379
  }

  if (-not (Test-Port 4100)) {
    Start-HiddenNpm @('run','start:license-server') 'license-server-auto.out.log' 'license-server-auto.err.log' | Out-Null
    Wait-Port 4100 30 | Out-Null
  }

  if (-not (Test-Port 5432)) {
    Write-ServiceLog 'PostgreSQL is not reachable on port 5432. Backend will not be started because login would fail.'
    "PORT 5432 OPEN=False"
    "PORT 4000 OPEN=$(Test-Port 4000)"
    "PORT 4100 OPEN=$(Test-Port 4100)"
    exit 2
  }

  Run-NpmWait @('run','setup:env') 'setup-env-auto.out.log' 'setup-env-auto.err.log' | Out-Null
  Run-NpmWait @('run','build:shared') 'build-shared-auto.out.log' 'build-shared-auto.err.log' | Out-Null
  Run-NpmWait @('run','setup:db') 'setup-db-auto.out.log' 'setup-db-auto.err.log' | Out-Null

  if (-not (Test-Port 4000)) {
    Start-HiddenNpm @('run','start','-w','apps/backend') 'backend-auto.out.log' 'backend-auto.err.log' | Out-Null
    Wait-Port 4000 45 | Out-Null
  }

  Write-ServiceLog "Final ports: 4000=$(Test-Port 4000) 4100=$(Test-Port 4100) 5432=$(Test-Port 5432) 6379=$(Test-Port 6379)"
  "PORT 4000 OPEN=$(Test-Port 4000)"
  "PORT 4100 OPEN=$(Test-Port 4100)"
  "PORT 5432 OPEN=$(Test-Port 5432)"
  "PORT 6379 OPEN=$(Test-Port 6379)"
} catch {
  Write-ServiceLog "Startup failed: $($_.Exception.Message)"
  Write-Host "SOM PRO startup failed: $($_.Exception.Message)"
  exit 1
}