[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$dist = Join-Path $projectRoot 'dist'
$expected = @(
    'h5p-find-and-correct-errors-library-1.0.5.h5p',
    'synthetic.h5p'
)

Add-Type -AssemblyName System.IO.Compression

function Read-ZipText {
    param([System.IO.Compression.ZipArchiveEntry] $Entry)
    $reader = [System.IO.StreamReader]::new($Entry.Open(), [System.Text.Encoding]::UTF8, $true)
    try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}

function Get-Sha256Hex {
    param([Parameter(Mandatory)] [string] $Path)
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        return ([System.BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $stream.Dispose()
        $algorithm.Dispose()
    }
}

foreach ($name in $expected) {
    $path = Join-Path $dist $name
    if (-not (Test-Path -LiteralPath $path)) { throw "Missing package: $name" }
    $stream = [System.IO.File]::OpenRead($path)
    try {
        $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Read, $false)
        try {
            $entries = @($archive.Entries)
            $paths = @($entries | ForEach-Object { $_.FullName })
            if ($paths | Where-Object { $_ -match '\\' }) { throw "$name contains non-portable backslash paths." }
            if (($paths | Group-Object | Where-Object Count -gt 1).Count) { throw "$name contains duplicate paths." }
            foreach ($requiredLibrary in @(
                'H5P.FindAndCorrectErrors-1.0/library.json',
                'H5PEditor.FindAndCorrectErrors-1.0/library.json'
            )) {
                if ($requiredLibrary -notin $paths) { throw "$name is missing $requiredLibrary" }
            }
            $runtimeEntry = $entries | Where-Object FullName -eq 'H5P.FindAndCorrectErrors-1.0/library.json'
            $runtime = Read-ZipText $runtimeEntry | ConvertFrom-Json
            $editorEntry = $entries | Where-Object FullName -eq 'H5PEditor.FindAndCorrectErrors-1.0/library.json'
            $editor = Read-ZipText $editorEntry | ConvertFrom-Json
            if ($runtime.machineName -ne 'H5P.FindAndCorrectErrors' -or $runtime.patchVersion -ne 5) {
                throw "$name contains unexpected runtime metadata."
            }
            if ($editor.machineName -ne 'H5PEditor.FindAndCorrectErrors' -or $editor.patchVersion -ne 3 -or $editor.runnable -ne 0) {
                throw "$name contains unexpected editor metadata."
            }
            if (-not ($runtime.editorDependencies | Where-Object machineName -eq 'H5PEditor.FindAndCorrectErrors')) {
                throw "$name is missing the editor dependency declaration."
            }
            $sharedDependencies = @($runtime.preloadedDependencies | ForEach-Object machineName | Sort-Object)
            $expectedSharedDependencies = @('FontAwesome', 'H5P.JoubelUI', 'H5P.Question')
            if (Compare-Object $sharedDependencies $expectedSharedDependencies) {
                throw "$name contains an unexpected shared dependency declaration."
            }
            $unexpectedBundled = @($paths | Where-Object {
                $_ -notin @('h5p.json', 'content/content.json') -and
                $_ -notlike 'H5P.FindAndCorrectErrors-1.0/*' -and
                $_ -notlike 'H5PEditor.FindAndCorrectErrors-1.0/*'
            })
            if ($unexpectedBundled.Count) {
                throw "$name bundles unexpected files or shared libraries: $($unexpectedBundled -join ', ')"
            }
            if ($name -like '*library*') {
                if ('h5p.json' -in $paths -or 'content/content.json' -in $paths) {
                    throw "$name must be a library-only installer."
                }
            }
            else {
                foreach ($requiredContent in @('h5p.json', 'content/content.json')) {
                    if ($requiredContent -notin $paths) { throw "$name is missing $requiredContent" }
                }
                $h5pEntry = $entries | Where-Object FullName -eq 'h5p.json'
                $h5p = Read-ZipText $h5pEntry | ConvertFrom-Json
                if (-not ($h5p.preloadedDependencies | Where-Object machineName -eq 'H5P.FindAndCorrectErrors')) {
                    throw "$name does not declare the runnable library."
                }
                Read-ZipText ($entries | Where-Object FullName -eq 'content/content.json') | ConvertFrom-Json | Out-Null
            }
        }
        finally { $archive.Dispose() }
    }
    finally { $stream.Dispose() }
}

$releaseCandidate = Join-Path $dist 'release-candidate-1.0.5'
$publicAllowList = @(
    'ACCESSIBILITY_REPORT_M6.md',
    'AUTHOR_GUIDE.md',
    'COMPATIBILITY_MATRIX.md',
    'COMPATIBILITY_REPORT_M6.md',
    'GUIDE_FR.md',
    'h5p-find-and-correct-errors-library-1.0.5.h5p',
    'INSTALLATION.md',
    'KNOWN_LIMITATIONS.md',
    'LICENSE',
    'README.md',
    'RELEASE_CHECKLIST.md',
    'RELEASE_GATE_M6.md',
    'RELEASE_NOTES.md',
    'SECURITY.md',
    'SECURITY_AND_LICENSE_AUDIT.md',
    'SHA256SUMS.txt',
    'synthetic.h5p',
    'THIRD_PARTY_NOTICES.md',
    'MILESTONE5_ACCESSIBILITY_REPORT.md'
) | Sort-Object
if (-not (Test-Path -LiteralPath $releaseCandidate -PathType Container)) { throw 'Missing public release-candidate directory.' }
$actualPublicFiles = @(Get-ChildItem -LiteralPath $releaseCandidate -File | Select-Object -ExpandProperty Name | Sort-Object)
if (Compare-Object $publicAllowList $actualPublicFiles) { throw 'Public release-candidate contents do not match the explicit allow-list.' }
if ($actualPublicFiles | Where-Object { $_ -match 'private|accords' }) { throw 'Public release candidate contains a private fixture name.' }
foreach ($line in Get-Content -LiteralPath (Join-Path $releaseCandidate 'SHA256SUMS.txt')) {
    if ($line -notmatch '^([0-9a-f]{64})  (.+)$') { throw "Malformed checksum line: $line" }
    $listedFile = Join-Path $releaseCandidate $Matches[2]
    if (-not (Test-Path -LiteralPath $listedFile -PathType Leaf)) { throw "Checksum references missing file: $($Matches[2])" }
    if ((Get-Sha256Hex -Path $listedFile) -ne $Matches[1]) {
        throw "Checksum mismatch: $($Matches[2])"
    }
}

"Validated $($expected.Count) H5P archives, both bundled libraries, portable paths, metadata, content JSON, and the public RC allow-list/checksums."
