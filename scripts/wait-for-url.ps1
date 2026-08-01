param(
  [Parameter(Mandatory=$true)][string]$Url,
  [int]$Seconds = 60,
  [string]$Name = "service"
)

$deadline = (Get-Date).AddSeconds($Seconds)
while ((Get-Date) -lt $deadline) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
      Write-Host "$Name is ready: $Url"
      exit 0
    }
  } catch {
    Start-Sleep -Seconds 2
  }
}
Write-Host "$Name did not become ready: $Url"
exit 1
