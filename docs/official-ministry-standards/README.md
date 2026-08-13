# Official Ministry Standards Archive

Purpose: store original official Ministry supplier standards obtained from `sapakim.education.gov.il` or another approved Ministry source.

Rules:

- Store original downloaded files without editing, recompressing, translating, or renaming after hashing.
- Record every file in `docs/MINISTRY_OFFICIAL_STANDARDS_INTAKE.md`.
- Record source URL, download date, document title, version/publication date, SHA-256, archive path, review owner, and status.
- Do not treat public context pages as replacements for official supplier standards unless the Ministry explicitly says they are controlling requirements.
- Do not commit secrets, credentials, personal data, or non-public school data in this archive.

Recommended filename format:

`MOS-001_supplier-information-security-standard_YYYY-MM-DD_original.pdf`

Hash command examples:

```bash
sha256sum docs/official-ministry-standards/MOS-001_supplier-information-security-standard_YYYY-MM-DD_original.pdf
```

```powershell
Get-FileHash docs\official-ministry-standards\MOS-001_supplier-information-security-standard_YYYY-MM-DD_original.pdf -Algorithm SHA256
```

Repository automation:

```bash
npm run ministry:standards:intake
```

This command scans this directory, calculates SHA-256 hashes, and validates `docs/MINISTRY_OFFICIAL_STANDARDS_INTAKE.md`.
