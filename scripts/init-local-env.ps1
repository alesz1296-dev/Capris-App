param(
  [int]$PostgresPort = 5433,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$envPath = Join-Path $repoRoot ".env"

function New-HexSecret {
  param([int]$Bytes = 32)

  $buffer = [byte[]]::new($Bytes)
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($buffer)
  } finally {
    $rng.Dispose()
  }
  return -join ($buffer | ForEach-Object { $_.ToString("x2") })
}

function Read-EnvFile {
  param([string]$Path)

  $values = [ordered]@{}
  if (!(Test-Path -LiteralPath $Path)) {
    return $values
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith("#")) {
      continue
    }

    $separatorIndex = $line.IndexOf("=")
    if ($separatorIndex -le 0) {
      continue
    }

    $key = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()
    $values[$key] = $value
  }

  return $values
}

function Set-Default {
  param(
    [System.Collections.Specialized.OrderedDictionary]$Values,
    [string]$Key,
    [string]$Value
  )

  if ($Force -or !$Values.Contains($Key) -or [string]::IsNullOrWhiteSpace($Values[$Key])) {
    $Values[$Key] = $Value
  }
}

$values = Read-EnvFile -Path $envPath
$postgresPassword = if ($Force -or !$values.Contains("POSTGRES_PASSWORD") -or [string]::IsNullOrWhiteSpace($values["POSTGRES_PASSWORD"])) {
  New-HexSecret -Bytes 24
} else {
  $values["POSTGRES_PASSWORD"]
}

$minioPassword = if ($Force -or !$values.Contains("MINIO_ROOT_PASSWORD") -or [string]::IsNullOrWhiteSpace($values["MINIO_ROOT_PASSWORD"])) {
  New-HexSecret -Bytes 24
} else {
  $values["MINIO_ROOT_PASSWORD"]
}

Set-Default $values "APP_TIMEZONE" "America/Costa_Rica"
Set-Default $values "POSTGRES_DB" "capris_app"
Set-Default $values "POSTGRES_USER" "capris_local_user"
Set-Default $values "POSTGRES_PASSWORD" $postgresPassword
Set-Default $values "POSTGRES_PORT" "$PostgresPort"
Set-Default $values "API_PORT" "4000"
Set-Default $values "WEB_PORT" "3000"
Set-Default $values "MINIO_API_PORT" "9000"
Set-Default $values "MINIO_CONSOLE_PORT" "9001"
Set-Default $values "DATABASE_URL" "postgresql://$($values["POSTGRES_USER"]):$($values["POSTGRES_PASSWORD"])@localhost:$($values["POSTGRES_PORT"])/$($values["POSTGRES_DB"])?schema=public"
Set-Default $values "DATABASE_URL_DOCKER" "postgresql://$($values["POSTGRES_USER"]):$($values["POSTGRES_PASSWORD"])@postgres:5432/$($values["POSTGRES_DB"])?schema=public"
Set-Default $values "JWT_ACCESS_SECRET" (New-HexSecret)
Set-Default $values "JWT_REFRESH_SECRET" (New-HexSecret)
Set-Default $values "MEDIA_URL_SIGNING_SECRET" (New-HexSecret)
Set-Default $values "CAPRIS_QA_PASSWORD" (New-HexSecret -Bytes 16)
Set-Default $values "OBJECT_STORAGE_DRIVER" "local"
Set-Default $values "OBJECT_STORAGE_DRIVER_DOCKER" "s3"
Set-Default $values "S3_BUCKET" "capris-local"
Set-Default $values "S3_REGION" "us-east-1"
Set-Default $values "S3_ENDPOINT" "http://localhost:9000"
Set-Default $values "S3_ENDPOINT_DOCKER" "http://minio:9000"
Set-Default $values "S3_ACCESS_KEY_ID" "capris_local_minio"
Set-Default $values "S3_SECRET_ACCESS_KEY" $minioPassword
Set-Default $values "MINIO_ROOT_USER" "capris_local_minio"
Set-Default $values "MINIO_ROOT_PASSWORD" $minioPassword
Set-Default $values "GOOGLE_CLIENT_ID" ""
Set-Default $values "NEXT_PUBLIC_API_BASE_URL" "http://localhost:4000/api/v1"
Set-Default $values "NEXT_PUBLIC_GOOGLE_CLIENT_ID" ""

$lines = @("# Generated local development environment. Do not commit this file.")
foreach ($key in $values.Keys) {
  $lines += "$key=$($values[$key])"
}

Set-Content -LiteralPath $envPath -Value $lines -Encoding utf8

Write-Output "Updated $envPath"
Write-Output "Postgres host URL configured for localhost:$($values["POSTGRES_PORT"])"
Write-Output "Docker API DB URL uses service host: postgres:5432"
Write-Output "QA users can sign in with CAPRIS_QA_PASSWORD from this untracked .env file."
