[CmdletBinding()]
param(
    [Parameter(Mandatory, Position = 0)]
    [string[]] $Path
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression

function Read-ZipText {
    param(
        [Parameter(Mandatory)] [System.IO.Compression.ZipArchive] $Archive,
        [Parameter(Mandatory)] [string] $Name
    )
    $entry = $Archive.GetEntry($Name)
    if ($null -eq $entry) { throw "Archive is missing $Name." }
    $reader = [System.IO.StreamReader]::new($entry.Open(), [System.Text.Encoding]::UTF8, $true)
    try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}

$results = foreach ($candidate in $Path) {
    $resolved = (Resolve-Path -LiteralPath $candidate).Path
    $stream = [System.IO.File]::OpenRead($resolved)
    try {
        $archive = [System.IO.Compression.ZipArchive]::new(
            $stream,
            [System.IO.Compression.ZipArchiveMode]::Read,
            $false
        )
        try {
            $entries = @($archive.Entries)
            $names = @($entries | ForEach-Object FullName)
            if ($names | Where-Object { $_ -match '\\' -or $_ -match '(^|/)\.\.(/|$)' -or $_ -match '^/' -or $_ -match '^[A-Za-z]:' }) {
                throw "$resolved contains an unsafe or non-portable archive path."
            }
            if (@($names | Group-Object | Where-Object Count -gt 1).Count) {
                throw "$resolved contains duplicate archive paths."
            }
            foreach ($required in @(
                'h5p.json',
                'content/content.json',
                'H5P.FindAndCorrectErrors-1.0/library.json',
                'H5PEditor.FindAndCorrectErrors-1.0/library.json'
            )) {
                if ($required -notin $names) { throw "$resolved is missing $required." }
            }

            $manifest = Read-ZipText -Archive $archive -Name 'h5p.json' | ConvertFrom-Json
            $content = Read-ZipText -Archive $archive -Name 'content/content.json' | ConvertFrom-Json
            $runtime = Read-ZipText -Archive $archive -Name 'H5P.FindAndCorrectErrors-1.0/library.json' | ConvertFrom-Json
            $editor = Read-ZipText -Archive $archive -Name 'H5PEditor.FindAndCorrectErrors-1.0/library.json' | ConvertFrom-Json

            if ($manifest.mainLibrary -ne 'H5P.FindAndCorrectErrors') {
                throw "$resolved has unexpected mainLibrary '$($manifest.mainLibrary)'."
            }
            if ($runtime.machineName -ne 'H5P.FindAndCorrectErrors' -or $runtime.patchVersion -ne 5) {
                throw "$resolved has unexpected runtime metadata."
            }
            if ($editor.machineName -ne 'H5PEditor.FindAndCorrectErrors' -or $editor.patchVersion -ne 3) {
                throw "$resolved has unexpected editor metadata."
            }
            if (-not [string]::IsNullOrWhiteSpace($content.markup) -and $content.markup.StartsWith("FCE2`n")) {
                $encodedModel = $content.markup.Substring(5)
                $model = [System.Net.WebUtility]::HtmlDecode($encodedModel) | ConvertFrom-Json
                if ($model.schemaVersion -ne 2 -or @($model.errors).Count -lt 1) {
                    throw "$resolved contains an invalid FCE2 model."
                }
                foreach ($error in $model.errors) {
                    if ($error.start -lt 0 -or $error.end -le $error.start -or $error.end -gt $model.source.Length) {
                        throw "$resolved contains an out-of-range target '$($error.id)'."
                    }
                    if ($model.source.Substring($error.start, $error.end - $error.start) -cne $error.source) {
                        throw "$resolved target '$($error.id)' does not match its source range."
                    }
                    if (@($error.accepted).Count -lt 1) {
                        throw "$resolved target '$($error.id)' has no accepted answer."
                    }
                }
            }
            else {
                throw "$resolved does not contain a versioned FCE2 authoring model."
            }

            [pscustomobject]@{
                File = [System.IO.Path]::GetFileName($resolved)
                Bytes = (Get-Item -LiteralPath $resolved).Length
                SHA256 = (Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash.ToLowerInvariant()
                Entries = $entries.Count
                Title = $manifest.title
                MainLibrary = $manifest.mainLibrary
                Runtime = "$($runtime.majorVersion).$($runtime.minorVersion).$($runtime.patchVersion)"
                Editor = "$($editor.majorVersion).$($editor.minorVersion).$($editor.patchVersion)"
                Targets = @($model.errors).Count
                AcceptedAnswers = @($model.errors | ForEach-Object { @($_.accepted).Count } | Measure-Object -Sum).Sum
                ValidationTiming = $content.behaviour.validationTiming
                DisplayMode = $content.behaviour.displayMode
            }
        }
        finally { $archive.Dispose() }
    }
    finally { $stream.Dispose() }
}

$results
"Validated $($results.Count) hosted H5P export(s): paths, manifests, library versions, FCE2 ranges and accepted answers."
