param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string] $Path
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')
$source = Resolve-Path -LiteralPath $Path
$targetDir = Join-Path $repoRoot.Path 'web\public\images\home'
$target = Join-Path $targetDir 'hero-background.png'

$allowedExtensions = @('.png', '.jpg', '.jpeg', '.webp')
$extension = [System.IO.Path]::GetExtension($source.Path).ToLowerInvariant()

if ($allowedExtensions -notcontains $extension) {
  throw "Unsupported image type '$extension'. Use PNG, JPG, JPEG, or WEBP."
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

if ([System.IO.Path]::GetFullPath($source.Path) -ne [System.IO.Path]::GetFullPath($target)) {
  Copy-Item -LiteralPath $source.Path -Destination $target -Force
}

Write-Host "Updated home hero background:"
Write-Host $target
