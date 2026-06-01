# stop-dev.ps1 — stop the TaskFlow dev servers (backend :8000, web :3000).
function Stop-Port($port) {
    $stopped = $false
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        if ($p -and ($p.ProcessName -eq "node" -or $p.ProcessName -eq "python")) {
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped $($p.ProcessName) (pid $($p.Id)) on port $port"
            $stopped = $true
        }
    }
    if (-not $stopped) { Write-Host "Nothing to stop on port $port" }
}
Stop-Port 8000
Stop-Port 3000
Write-Host "Dev servers stopped." -ForegroundColor Green
