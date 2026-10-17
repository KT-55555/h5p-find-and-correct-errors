[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$dist = Join-Path $projectRoot 'dist'
$librarySource = Join-Path $projectRoot 'H5P.FindAndCorrectErrors'
$libraryFolderName = 'H5P.FindAndCorrectErrors-1.0'
$editorSource = Join-Path $projectRoot 'H5PEditor.FindAndCorrectErrors'
$editorFolderName = 'H5PEditor.FindAndCorrectErrors-1.0'

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function New-H5pArchive {
    param(
        [Parameter(Mandatory)] [string] $SourceDirectory,
        [Parameter(Mandatory)] [string] $DestinationPath
    )

    $sourceFull = [System.IO.Path]::GetFullPath($SourceDirectory).TrimEnd('\') + '\'
    if (Test-Path -LiteralPath $DestinationPath) {
        Remove-Item -LiteralPath $DestinationPath -Force
    }
    $archiveStream = [System.IO.File]::Open(
        $DestinationPath,
        [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
    )
    try {
        $archive = [System.IO.Compression.ZipArchive]::new(
            $archiveStream,
            [System.IO.Compression.ZipArchiveMode]::Create,
            $false
        )
        try {
            foreach ($file in Get-ChildItem -LiteralPath $SourceDirectory -Recurse -File | Sort-Object FullName) {
                $fileFull = [System.IO.Path]::GetFullPath($file.FullName)
                if (-not $fileFull.StartsWith($sourceFull, [System.StringComparison]::OrdinalIgnoreCase)) {
                    throw "Refusing to package file outside staging directory: $fileFull"
                }
                $relative = $fileFull.Substring($sourceFull.Length)
                $entryName = $relative.Replace('\', '/')
                $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
                # ZIP timestamps otherwise make identical source trees produce different hashes.
                $entry.LastWriteTime = [DateTimeOffset]::new(2000, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
                $entryStream = $entry.Open()
                $inputStream = [System.IO.File]::OpenRead($file.FullName)
                try {
                    $inputStream.CopyTo($entryStream)
                }
                finally {
                    $inputStream.Dispose()
                    $entryStream.Dispose()
                }
            }
        }
        finally {
            $archive.Dispose()
        }
    }
    finally {
        $archiveStream.Dispose()
    }
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

function Remove-DirectoryWithRetry {
    param([Parameter(Mandatory)] [string] $Path)
    for ($attempt = 1; $attempt -le 10; $attempt++) {
        try {
            Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
            return
        }
        catch [System.IO.IOException] {
            if ($attempt -eq 10) { throw }
            Start-Sleep -Milliseconds 200
        }
        catch [System.UnauthorizedAccessException] {
            if ($attempt -eq 10) { throw }
            Start-Sleep -Milliseconds 200
        }
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $librarySource 'library.json'))) {
    throw 'Library source is missing library.json.'
}

New-Item -ItemType Directory -Path $dist -Force | Out-Null
foreach ($obsoleteLibraryPackageName in @(
    'h5p-find-and-correct-errors-library-1.0.0.h5p',
    'h5p-find-and-correct-errors-library-1.0.1.h5p',
    'h5p-find-and-correct-errors-library-1.0.2.h5p',
    'h5p-find-and-correct-errors-library-1.0.3.h5p',
    'h5p-find-and-correct-errors-library-1.0.4.h5p'
)) {
    $obsoleteLibraryPackage = Join-Path $dist $obsoleteLibraryPackageName
    if (Test-Path -LiteralPath $obsoleteLibraryPackage) {
        Remove-Item -LiteralPath $obsoleteLibraryPackage -Force
    }
}
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('h5p-fce-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempRoot | Out-Null

try {
    $libraryStage = Join-Path $tempRoot 'library'
    New-Item -ItemType Directory -Path $libraryStage | Out-Null
    Copy-Item -LiteralPath $librarySource -Destination (Join-Path $libraryStage $libraryFolderName) -Recurse
    Copy-Item -LiteralPath $editorSource -Destination (Join-Path $libraryStage $editorFolderName) -Recurse
    $libraryH5p = Join-Path $dist 'h5p-find-and-correct-errors-library-1.0.5.h5p'
    New-H5pArchive -SourceDirectory $libraryStage -DestinationPath $libraryH5p

    foreach ($sampleName in @('synthetic')) {
        $sampleSource = Join-Path $projectRoot ('samples\' + $sampleName)
        $sampleStage = Join-Path $tempRoot $sampleName
        New-Item -ItemType Directory -Path $sampleStage | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $sampleStage 'content') | Out-Null
        Copy-Item -LiteralPath (Join-Path $sampleSource 'content.json') -Destination (Join-Path $sampleStage 'content\content.json')
        Copy-Item -LiteralPath (Join-Path $sampleSource 'h5p.json') -Destination (Join-Path $sampleStage 'h5p.json')
        Copy-Item -LiteralPath $librarySource -Destination (Join-Path $sampleStage $libraryFolderName) -Recurse
        Copy-Item -LiteralPath $editorSource -Destination (Join-Path $sampleStage $editorFolderName) -Recurse
        $sampleH5p = Join-Path $dist ($sampleName + '.h5p')
        New-H5pArchive -SourceDirectory $sampleStage -DestinationPath $sampleH5p
    }

    # Public release-candidate bundle. Deliberately allow-list files so the
    # private French regression fixture can never enter this directory.
    $releaseCandidate = Join-Path $dist 'release-candidate-1.0.5'
    if (Test-Path -LiteralPath $releaseCandidate) {
        $resolvedCandidate = (Resolve-Path -LiteralPath $releaseCandidate).Path
        $resolvedDist = (Resolve-Path -LiteralPath $dist).Path
        if (-not $resolvedCandidate.StartsWith($resolvedDist + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to replace release candidate outside dist: $resolvedCandidate"
        }
        Remove-DirectoryWithRetry -Path $resolvedCandidate
    }
    New-Item -ItemType Directory -Path $releaseCandidate | Out-Null
    $publishedPayloads = @(
        'h5p-find-and-correct-errors-library-1.0.5.h5p',
        'synthetic.h5p'
    )
    foreach ($publicArtifact in $publishedPayloads) {
        Copy-Item -LiteralPath (Join-Path $dist $publicArtifact) -Destination (Join-Path $releaseCandidate $publicArtifact)
    }
    $publicDocuments = @(
        'LICENSE',
        'README.md',
        'INSTALLATION.md',
        'AUTHOR_GUIDE.md',
        'COMPATIBILITY_MATRIX.md',
        'GUIDE_FR.md',
        'RELEASE_CHECKLIST.md',
        'RELEASE_NOTES.md',
        'SECURITY.md',
        'SECURITY_AND_LICENSE_AUDIT.md',
        'MILESTONE5_ACCESSIBILITY_REPORT.md',
        'ACCESSIBILITY_REPORT_M7.md',
        'COMPATIBILITY_REPORT_M7.md',
        'EXPORT_IMPORT_REPORT_M7.md',
        'RELEASE_GATE_M7.md',
        'THIRD_PARTY_NOTICES.md',
        'KNOWN_LIMITATIONS.md'
    )
    foreach ($publicDocument in $publicDocuments) {
        Copy-Item -LiteralPath (Join-Path $projectRoot $publicDocument) -Destination (Join-Path $releaseCandidate $publicDocument)
    }
    $documentationStage = Join-Path $tempRoot 'documentation'
    New-Item -ItemType Directory -Path $documentationStage | Out-Null
    foreach ($publicDocument in $publicDocuments) {
        Copy-Item -LiteralPath (Join-Path $projectRoot $publicDocument) -Destination (Join-Path $documentationStage $publicDocument)
    }
    $documentationArchiveName = 'h5p-find-and-correct-errors-documentation-1.0.5.zip'
    New-H5pArchive -SourceDirectory $documentationStage -DestinationPath (Join-Path $releaseCandidate $documentationArchiveName)
    $publishedPayloads += $documentationArchiveName

    $checksumLines = $publishedPayloads |
        Sort-Object |
        ForEach-Object {
            $hash = Get-Sha256Hex -Path (Join-Path $releaseCandidate $_)
            "$hash  $_"
        }
    Set-Content -LiteralPath (Join-Path $releaseCandidate 'SHA256SUMS.txt') -Value $checksumLines -Encoding utf8
}
finally {
    $resolvedTemp = (Resolve-Path -LiteralPath $tempRoot -ErrorAction SilentlyContinue).Path
    $systemTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    if ($resolvedTemp -and $resolvedTemp.StartsWith($systemTemp, [System.StringComparison]::OrdinalIgnoreCase) -and
        (Split-Path -Leaf $resolvedTemp).StartsWith('h5p-fce-')) {
        Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
    }
}

Get-ChildItem -LiteralPath $dist -Filter '*.h5p' | Select-Object Name, Length, LastWriteTime
Get-ChildItem -LiteralPath (Join-Path $dist 'release-candidate-1.0.5') -File | Select-Object Name, Length

