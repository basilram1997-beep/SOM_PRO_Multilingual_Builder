# File Upload Scanning Policy

## Status

This control is complete by design for the current product scope:

- SOM PRO does not currently provide a general file upload workflow for school data.
- The product intentionally fails closed on multipart upload paths that could carry protected school content.
- No production workflow should depend on ad hoc file transfer as a normal school-data path.

If a future upload feature is ever added, it must follow this order:

1. Authenticate the uploader.
2. Validate the file type and size.
3. Scan the file for malware.
4. Store the file safely.
5. Log the operation.
6. Reject unsafe content.

## Placeholder interface expectation

- The upload layer should call a scanning service before saving the file.
- If scanning is not available, the upload must fail closed.

## Minimum protections

- Allowed file types must be explicit.
- File names must be sanitized.
- Sensitive files must not be exposed publicly.
- Upload results must be auditable.
- Upload retention and deletion must be documented before enablement.
