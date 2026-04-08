# Install GPU Monitor extension locally into Cursor / VS Code.
# Windows PowerShell. Run from the repo root.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot

Write-Host "📦 Installing dependencies..."
npm install

Write-Host "🔨 Compiling TypeScript..."
npm run compile

$pkg     = Get-Content "package.json" | ConvertFrom-Json
$extId   = "$($pkg.publisher).$($pkg.name)-$($pkg.version)"
$deps    = @("ssh2","asn1","bcrypt-pbkdf","safer-buffer","tweetnacl","cpu-features")

$installed = 0
foreach ($base in @(
    "$env:USERPROFILE\.cursor\extensions",
    "$env:USERPROFILE\.vscode\extensions"
)) {
    if (-not (Test-Path $base)) { continue }

    $dest = Join-Path $base $extId
    Write-Host "📂 Installing to: $dest"

    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    New-Item $dest -ItemType Directory | Out-Null

    Copy-Item "out","media","package.json" -Destination $dest -Recurse

    $nmDest = Join-Path $dest "node_modules"
    New-Item $nmDest -ItemType Directory | Out-Null
    foreach ($dep in $deps) {
        $src = Join-Path "node_modules" $dep
        if (Test-Path $src) { Copy-Item $src -Destination $nmDest -Recurse }
    }

    Write-Host "✅ Installed to $dest"
    $installed++
}

if ($installed -eq 0) {
    Write-Error "Neither ~/.cursor/extensions nor ~/.vscode/extensions found. Install Cursor or VS Code first."
}

Write-Host ""
Write-Host "🎉 Done! Restart Cursor / VS Code and look for the chip icon in the Activity Bar."

Pop-Location
