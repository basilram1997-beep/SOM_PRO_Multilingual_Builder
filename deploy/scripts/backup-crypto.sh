#!/usr/bin/env sh
set -eu

require_backup_passphrase() {
  if [ -z "${SOM_BACKUP_PASSPHRASE:-}" ]; then
    echo "SOM_BACKUP_PASSPHRASE is required for encrypted backup and restore operations." >&2
    exit 1
  fi
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
    return
  fi
  shasum -a 256 "$1" | awk '{print $1}'
}

encrypt_backup_file() {
  plaintext_file=$1
  encrypted_file=$2
  require_backup_passphrase
  openssl enc -aes-256-cbc -salt -pbkdf2 -iter "${SOM_BACKUP_KDF_ITERATIONS:-310000}" \
    -in "$plaintext_file" \
    -out "$encrypted_file" \
    -pass env:SOM_BACKUP_PASSPHRASE
}

decrypt_backup_file() {
  encrypted_file=$1
  plaintext_file=$2
  require_backup_passphrase
  openssl enc -d -aes-256-cbc -pbkdf2 -iter "${SOM_BACKUP_KDF_ITERATIONS:-310000}" \
    -in "$encrypted_file" \
    -out "$plaintext_file" \
    -pass env:SOM_BACKUP_PASSPHRASE
}

write_backup_manifest() {
  manifest_file=$1
  artifact_file=$2
  artifact_type=$3
  plaintext_sha256=$4
  started_at=$5
  completed_at=$6
  rpo_minutes=${SOM_BACKUP_RPO_MINUTES:-60}
  rto_minutes=${SOM_BACKUP_RTO_MINUTES:-240}
  artifact_sha256=$(sha256_file "$artifact_file")
  artifact_bytes=$(wc -c < "$artifact_file" | tr -d ' ')

  cat > "$manifest_file" <<EOF_MANIFEST
{
  "version": 1,
  "artifactType": "$artifact_type",
  "encrypted": true,
  "encryption": {
    "tool": "openssl",
    "algorithm": "aes-256-cbc",
    "kdf": "pbkdf2",
    "iterations": ${SOM_BACKUP_KDF_ITERATIONS:-310000}
  },
  "artifact": "$(basename "$artifact_file")",
  "artifactSha256": "$artifact_sha256",
  "artifactBytes": $artifact_bytes,
  "plaintextSha256": "$plaintext_sha256",
  "startedAt": "$started_at",
  "completedAt": "$completed_at",
  "targets": {
    "rpoMinutes": $rpo_minutes,
    "rtoMinutes": $rto_minutes
  }
}
EOF_MANIFEST
}
