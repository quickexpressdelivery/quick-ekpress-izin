[System.Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=== SISTEM BÜTÜNLÜĞÜ DENETİMİ ==="

Write-Host "`n[1] TEST: /api/state"
try {
    $res1 = Invoke-RestMethod -Uri "http://localhost:3000/api/state" -Method Get
    $groups = $res1.groups
    $groupNames = ($groups | Get-Member -MemberType NoteProperty).Name
    Write-Host ("Grup Sayısı: " + $groupNames.Count + " (Beklenen: 8)")
    $totalCouriers = 0
    foreach ($g in $groupNames) {
        $cCount = ($groups.$g).Count
        $totalCouriers += $cCount
        Write-Host ("  - Grup " + $g + ": " + $cCount + " kurye")
    }
    Write-Host ("Toplam Kurye: " + $totalCouriers)
    Write-Host ("Hafta Başlangıç: " + $res1.weekStartDate)
    Write-Host ("Durum: " + $(if ($groupNames.Count -eq 8) { "BAŞARILI (8 Grup Eksiksiz)" } else { "BAŞARISIZ" }))
} catch {
    Write-Host ("HATA: " + $_.Exception.Message)
}

Write-Host "`n[2] TEST: /api/export/csv"
try {
    $webClient = New-Object System.Net.WebClient
    $webClient.Encoding = [System.Text.Encoding]::UTF8
    $csvBytes = $webClient.DownloadData("http://localhost:3000/api/export/csv")
    $hasBom = ($csvBytes.Length -ge 3 -and $csvBytes[0] -eq 0xEF -and $csvBytes[1] -eq 0xBB -and $csvBytes[2] -eq 0xBF)
    Write-Host ("CSV Boyutu: " + $csvBytes.Length + " byte")
    Write-Host ("UTF-8 BOM Kontrolü: " + $(if ($hasBom) { "BAŞARILI (EF BB BF Mevcut - Excel Türkçe Uyumlu)" } else { "BAŞARISIZ (BOM Yok)" }))
    $csvText = [System.Text.Encoding]::UTF8.GetString($csvBytes)
    $lines = $csvText -split "`r`n|`n"
    Write-Host ("CSV Satır Sayısı: " + $lines.Count)
    Write-Host "İlk 5 Satır:"
    for ($i = 0; $i -lt [Math]::Min(5, $lines.Count); $i++) {
        Write-Host ("  " + $lines[$i])
    }
} catch {
    Write-Host ("HATA: " + $_.Exception.Message)
}

Write-Host "`n[3] TEST: /api/tunnel-url"
try {
    $res3 = Invoke-RestMethod -Uri "http://localhost:3000/api/tunnel-url" -Method Get
    Write-Host ("Tünel URL: " + $res3.tunnelUrl)
    $isHttps = $res3.tunnelUrl -like "https://*"
    Write-Host ("HTTPS Durumu: " + $(if ($isHttps) { "BAŞARILI (Canlı HTTPS Tüneli Aktif)" } else { "BAŞARISIZ" }))
} catch {
    Write-Host ("HATA: " + $_.Exception.Message)
}
