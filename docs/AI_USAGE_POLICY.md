# AI Usage Policy

## Status

AI features are disabled in the MVP.

## Architecture rule

- Any future AI module must stay isolated from the core school management flow.
- AI must be guarded by an explicit `ai_enabled=false` default and opt-in configuration before it can run.
- AI history, prompts, and outputs must live in a separate storage path and never mix with core student data.

## Development-only rule

- AI may only be used with fake or synthetic data during development.
- Real student, teacher, school, or ministry data must not be sent to AI tools by default.
- Any future AI integration must be isolated behind an explicit opt-in flag.

## Minimum safeguards for any future AI feature

- `ai_enabled=false` by default.
- No training on customer data without written approval.
- Content filtering before input and after output.
- Prompt length limits.
- Output monitoring and moderation.
- Ability to delete history if AI history is stored later.
- Encryption for any stored AI history.
- Deletion APIs for AI history should exist before any public AI launch.
- AI logs must never store raw sensitive payloads.

## Data-handling rules

- Do not send personal or sensitive school data to third-party AI tools unless explicitly approved.
- Do not use AI for marketing, profiling, or vendor analytics.
- Prefer local fake examples when building or testing prompts.
- Keep the AI module separate from the main reports, attendance, grades, and identity flows.
