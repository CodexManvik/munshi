# Downloads the candidate Hindi voices, checks each SHA-256, and copies them into the debug app's private
# storage (files/voices) for the "Awaaz jaanch" screen. Run with the phone connected and Munshi (debug build)
# installed:
#   pwsh android/scripts/push-voices.ps1
# Android 11+ blocks or breaks adb writes into /sdcard/Android/data, so each voice goes to /data/local/tmp
# first and is streamed into the app with run-as (works for any debuggable build).
$ErrorActionPreference = 'Stop'
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
# Windows' own bsdtar: Git's tar (first on PATH in Git Bash) reads "C:\..." as a remote host.
$tar = Join-Path $env:SystemRoot 'System32\tar.exe'
$app = 'com.opuscube.munshi'
$base = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models'
# fp32 Piper: the fp16 files fail to load in sherpa-onnx 1.13.8's onnxruntime ("tensor(float16) ... does
# not match expected type (tensor(float))").
$candidates = [ordered]@{
  'vits-piper-hi_IN-pratham-medium'    = '2084d321e1d2752f2b64ed3012ba27751df01a80da46f52920098cdcb7e35648'
  'vits-piper-hi_IN-priyamvada-medium' = '399d91cc97eb288725633261f26b715f9a971e3bf7ec4fa1d7910cd0080d37eb'
  'vits-piper-hi_IN-rohan-medium'      = 'f0bb7781724951e9c90c49f68abfe821cffcbc198a9ae0031366d045a6ad5488'
  'kokoro-int8-multi-lang-v1_0'        = '4c3052abaa60943a341f193888cf6abd68787dae6ab8ae5c925a706caa247e4e'
}

function Adb { & $adb @args; if ($LASTEXITCODE -ne 0) { throw "adb $args failed ($LASTEXITCODE)" } }

$work = Join-Path $env:TEMP 'munshi-voices'
New-Item -ItemType Directory -Force $work | Out-Null
$stage = '/data/local/tmp/munshi-voices'
Adb shell "rm -rf $stage && mkdir -p $stage"
Adb shell "run-as $app sh -c 'rm -rf files/voices && mkdir -p files/voices'"
foreach ($name in $candidates.Keys) {
  $archive = Join-Path $work "$name.tar.bz2"
  $want = $candidates[$name]
  if (-not (Test-Path $archive) -or (Get-FileHash $archive -Algorithm SHA256).Hash.ToLower() -ne $want) {
    Write-Host "Downloading $name"
    Invoke-WebRequest "$base/$name.tar.bz2" -OutFile $archive
  }
  $got = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLower()
  if ($got -ne $want) { throw "SHA-256 mismatch for ${name}: $got" }
  $folder = Join-Path $work $name
  if (-not (Test-Path $folder)) { & $tar -xjf $archive -C $work; if ($LASTEXITCODE -ne 0) { throw "tar failed for $name" } }
  if (-not (Test-Path $folder)) { throw "Archive $name did not unpack to a folder named $name" }
  Write-Host "Pushing $name"
  Adb push $folder $stage | Out-Null
  Adb shell "cd $stage && tar cf - $name | run-as $app sh -c 'rm -rf files/voices/$name && tar xf - -C files/voices'"
}
Adb shell "rm -rf $stage"
Adb shell "run-as $app ls files/voices"
