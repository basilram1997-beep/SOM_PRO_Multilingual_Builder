# Third-Party Services

This document lists the external services that SOM PRO may use and the rules for each one.

## Default rule

- Third-party integrations are disabled by default unless explicitly enabled.
- No student data should be sent to a third party unless it is listed here and explicitly approved by the school or authority.
- The global safety flag `SOM_DISABLE_THIRD_PARTY_INTEGRATIONS=true` disables outbound third-party notifications.
- The repository ships with a closed allowlist. Anything not listed below is denied by policy.
- No new third-party integration may be used in production until it is added here, approved, and tested for data minimization.

## Allowed only by explicit configuration

### Notification webhook / SMS gateway

- Environment variables:
  - `SOM_NOTIFICATION_WEBHOOK_URL`
  - `SOM_SMS_WEBHOOK_URL`
  - `SOM_NOTIFICATION_WEBHOOK_TOKEN`
- Purpose:
  - Sending approved school notifications such as attendance alerts.
- Data rule:
  - Send only the minimum data needed for the notification.
  - Do not send full school records or unnecessary PII.
  - Do not send grades, behavior text, attendance history, or certificate data unless a school explicitly approves the exact payload.

### Central license server

- Environment variables:
  - `SOM_PRO_LICENSE_SERVER_URL`
  - `SOM_LICENSE_SERVER_URL`
- Purpose:
  - License validation and activation.
- Data rule:
  - Send only license and device fields required for licensing.
  - Do not send student or grade data.
  - Do not send school lists, student lists, attendance, grades, or notes.

## Not enabled in this repository by default

- Analytics providers.
- Marketing trackers.
- External CRM systems.
- Email delivery providers for school content.
- WhatsApp APIs.
- Cloud storage for sensitive school data.
- Error monitoring that captures student content.
- AI services that receive school data.
- Social login providers.
- Support chat widgets that capture school content.
- Any outbound integration not named above.

## Additional rule

- If a future integration is added, it must be documented here, approved, and covered by a data-minimization check before use.
- Sensitive data must be scrubbed from logs and error payloads before any outbound call.
