$ProgressPreference='SilentlyContinue'
$out = Join-Path (Split-Path -Parent $PSScriptRoot) 'logs\nettest.txt'
$r = @()
$tests = @(
 @{n='tcmb-default'; u='https://www.tcmb.gov.tr/kurlar/today.xml'; ua=$null},
 @{n='tcmb-alpicim'; u='https://www.tcmb.gov.tr/kurlar/today.xml'; ua='Alpicim/0.1.0 (Windows masaustu; RSS okuyucu)'},
 @{n='tcmb-browser'; u='https://www.tcmb.gov.tr/kurlar/today.xml'; ua='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'},
 @{n='tcmb-archive'; u='https://www.tcmb.gov.tr/kurlar/202610/22102026.xml'; ua=$null},
 @{n='frankfurter'; u='https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY'; ua='Alpicim/0.1.0 (Windows masaustu; RSS okuyucu)'}
)
foreach ($t in $tests) {
  $sw=[Diagnostics.Stopwatch]::StartNew()
  try {
    $p=@{Uri=$t.u; UseBasicParsing=$true; TimeoutSec=20}
    if ($t.ua) { $p.UserAgent=$t.ua }
    $res=Invoke-WebRequest @p
    $r += "$($t.n): HTTP $($res.StatusCode) $($res.Content.Length) bayt $([int]$sw.Elapsed.TotalMilliseconds) ms :: $($res.Content.Substring(0,[Math]::Min(120,$res.Content.Length)) -replace '\s+',' ')"
  } catch { $r += "$($t.n): HATA $([int]$sw.Elapsed.TotalMilliseconds) ms :: $($_.Exception.Message)" }
}
$curl = & curl.exe -s -o NUL -w "%{http_code} %{http_version} %{time_total}s" --max-time 20 https://www.tcmb.gov.tr/kurlar/today.xml 2>&1
$r += "curl: $curl"
$curl2 = & curl.exe -s -o NUL -w "%{http_code} %{http_version} %{time_total}s" --http1.1 -A "Alpicim/0.1.0" --max-time 20 https://www.tcmb.gov.tr/kurlar/today.xml 2>&1
$r += "curl-http1.1-alpicimUA: $curl2"
$r | Set-Content -Path $out -Encoding UTF8
