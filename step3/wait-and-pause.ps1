# After block N saves: restart scraper with pause-before-Create-Test handoff
param([int]$Block = 35)
$step3 = "C:\Users\steve\MeWorld\step3"
$pattern = "Saved:.*scrape-playwright-block${Block}\.json"
Write-Host "Watching for block $Block save, then restart with pause before Create Test..."

while ($true) {
  Get-ChildItem "$env:USERPROFILE\.cursor\projects\*\terminals\*.txt" -ErrorAction SilentlyContinue | ForEach-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -match $pattern -and $content -notmatch 'PAUSED before Create Test') {
      Write-Host "Block $Block saved - restarting with handoff pause..."
      Start-Sleep -Seconds 1
      Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object {
        try {
          $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
          if ($cmd -match 'playwright-scrape-qb|wait-and-pause') {
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
          }
        } catch {}
      }
      Start-Sleep -Seconds 2
      $next = $Block + 1
      Set-Location $step3
      Start-Process -NoNewWindow -FilePath "node" -ArgumentList @(
        "playwright-scrape-qb.js", "--loop", "--auto-next", "--auto-start", "--start-block", "$next"
      )
      Write-Host "Restarted start-block $next - will pause before Create Test"
      exit 0
    }
  }
  Start-Sleep -Seconds 8
}
