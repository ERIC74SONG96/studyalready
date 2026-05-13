# Regénère le vendor Supabase : ESM bundlé + UMD minifié (pages HTML classiques).
# Nécessite Node.js + npm + curl. Exécuter : powershell -File tools/build-supabase-vendor.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$tmp = Join-Path $env:TEMP ("sa-supabase-build-" + [Guid]::NewGuid().ToString("n"))
$out = Join-Path $root "assets\js\vendor\supabase-js-2.49.4.mjs"
$umd = Join-Path $root "assets\js\vendor\supabase-umd-2.49.4.min.js"
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Push-Location $tmp
try {
  npm init -y 2>$null | Out-Null
  npm install @supabase/supabase-js@2.49.4 esbuild@0.24.2 --no-fund --no-audit
  npx esbuild "./node_modules/@supabase/supabase-js/dist/module/index.js" `
    --bundle --format=esm --platform=browser --target=es2022 --legal-comments=none `
    --outfile="$out"
  Write-Host "OK -> $out"
} finally {
  Pop-Location
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue }
}

curl.exe -sSL "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js" -o "$umd"
Write-Host "OK -> $umd"
