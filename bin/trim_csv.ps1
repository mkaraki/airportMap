$orig_csv = Import-Csv -Path $args[0]

$omitted = $orig_csv | Select-Object -Property @('id', 'name', 'latitude_deg', 'longitude_deg', 'scheduled_service', 'ident', 'iata_code')

$omitted | Export-Csv -Path $args[1] -NoTypeInformation -Delimiter ',' -Encoding utf8