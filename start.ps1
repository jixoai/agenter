#!/usr/bin/env pwsh
# Agenter Queue Workflow Launcher

$ErrorActionPreference = "Stop"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) { Write-Output $args }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput Cyan @"
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║              Agenter - Queue Workflow TUI                        ║
║                                                                  ║
║     Ctrl+Enter=Queue | Shift+Enter=Now | Enter=New/Edit          ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
"@

# Check bun
try {
    $bunVersion = bun --version 2>$null
    Write-ColorOutput Green "✓ Bun $bunVersion"
} catch {
    Write-ColorOutput Red "✗ Bun not installed. https://bun.sh"
    exit 1
}

# Cleanup
Get-Process -Name "bun" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Start API Server
Write-Output ""
Write-ColorOutput Yellow "Starting WebSocket API Server..."
$apiJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    bun run src/api-ws.ts
}

# Wait for server
Write-Output "Waiting for server..."
Start-Sleep -Seconds 3

# Start TUI
Write-Output ""
Write-ColorOutput Cyan "Starting Queue Workflow TUI..."
Write-Output ""
Write-ColorOutput White "Quick Guide:"
Write-Output "  1. Type a message"
Write-Output "  2. Ctrl+Enter to queue, or Shift+Enter for immediate"
Write-Output "  3. Press Enter to create/jump to editing tab"
Write-Output "  4. Queue processes automatically (FIFO)"
Write-Output ""

Set-Location tui-react
try {
    bun run dev
} finally {
    Write-Output ""
    Write-ColorOutput Yellow "Shutting down..."
    Stop-Job $apiJob -ErrorAction SilentlyContinue
    Remove-Job $apiJob -ErrorAction SilentlyContinue
    Get-Process -Name "bun" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-ColorOutput Green "✓ Done"
}
