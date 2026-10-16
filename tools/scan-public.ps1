[CmdletBinding()]
param(
    [string] $Root = '.'
)

$ErrorActionPreference = 'Stop'
$rootPath = (Resolve-Path -LiteralPath $Root).Path
$textExtensions = @('.css', '.html', '.js', '.json', '.md', '.mjs', '.ps1', '.txt', '.yml', '.yaml')
$forbiddenPathPatterns = @(
    '(?i)(^|[\\/])(?:hotpot examples|private|node_modules)([\\/]|$)',
    '(?i)local-wordpress',
    '(?i)import-private\.test'
)
$sensitiveContentPatterns = @(
    '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    '(?i)github_pat_[A-Za-z0-9_]{20,}',
    '(?i)gh[pousr]_[A-Za-z0-9]{20,}',
    '(?i)AKIA[0-9A-Z]{16}',
    '(?i)xox[baprs]-[A-Za-z0-9-]{20,}',
    '(?i)(?:password|secret|access[_-]?token)\s*[:=]\s*["''][^"'']{8,}["'']',
    '(?i)[A-Z]:\\(?:Users|Dropbox)\\',
    '(?i)\\\\[^\\\s]+\\[^\\\s]+\\'
)

function Test-TextContent {
    param(
        [Parameter(Mandatory)] [string] $Label,
        [Parameter(Mandatory)] [string] $Content
    )
    foreach ($pattern in $sensitiveContentPatterns) {
        if ($Content -match $pattern) {
            throw "Sensitive-content pattern matched in $Label."
        }
    }
}

$files = @(Get-ChildItem -LiteralPath $rootPath -Recurse -Force -File | Where-Object {
    $_.FullName -notmatch '[\\/]\.git[\\/]' -and
    $_.FullName -notmatch '[\\/]node_modules[\\/]' -and
    $_.FullName -notmatch '[\\/]evidence[\\/]'
})
if (Test-Path -LiteralPath (Join-Path $rootPath '.git')) {
    $trackedEvidence = @(& git -C $rootPath ls-files 'evidence/*')
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect tracked evidence paths.' }
    if ($trackedEvidence.Count) { throw "Generated evidence is tracked publicly: $($trackedEvidence -join ', ')" }
}
foreach ($file in $files) {
    $relative = $file.FullName.Substring($rootPath.Length).TrimStart('\', '/').Replace('\', '/')
    foreach ($pattern in $forbiddenPathPatterns) {
        if ($relative -match $pattern) {
            throw "Forbidden public path: $relative"
        }
    }
    if ($textExtensions -contains $file.Extension.ToLowerInvariant() -and $file.Name -ne 'scan-public.ps1') {
        Test-TextContent -Label $relative -Content (Get-Content -LiteralPath $file.FullName -Raw)
    }
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
foreach ($archiveFile in $files | Where-Object { $_.Extension -in @('.h5p', '.zip') }) {
    $archive = [System.IO.Compression.ZipFile]::OpenRead($archiveFile.FullName)
    try {
        foreach ($entry in $archive.Entries) {
            if ($entry.FullName -match '(^|/)\.\.(/|$)' -or $entry.FullName.StartsWith('/') -or $entry.FullName -match '^[A-Za-z]:') {
                throw "Unsafe archive path in $($archiveFile.Name): $($entry.FullName)"
            }
            foreach ($pattern in $forbiddenPathPatterns) {
                if ($entry.FullName -match $pattern) {
                    throw "Forbidden archive path in $($archiveFile.Name): $($entry.FullName)"
                }
            }
            $entryExtension = [System.IO.Path]::GetExtension($entry.FullName).ToLowerInvariant()
            if ($entry.Length -le 2MB -and $textExtensions -contains $entryExtension) {
                $reader = [System.IO.StreamReader]::new($entry.Open(), [System.Text.Encoding]::UTF8, $true)
                try { Test-TextContent -Label "$($archiveFile.Name):$($entry.FullName)" -Content $reader.ReadToEnd() }
                finally { $reader.Dispose() }
            }
        }
    }
    finally { $archive.Dispose() }
}

"Public scan passed: $($files.Count) files and $(@($files | Where-Object { $_.Extension -in @('.h5p', '.zip') }).Count) archives inspected."
