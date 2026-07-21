# Security Audit Remediation — Horizon Flight Platform

This document maps OWASP Top 10 / CWE Top 25 items requested in review
to the exact code mitigations applied.

See the PR conversation / agent response for the human-readable report.
Key modules:
- `backend/src/common/security/`
- `backend/src/modules/auth/`
- `backend/src/modules/tracking-ingestion/opensky.client.ts`
- `realtime-engine/src/streaming/socket-gateway.ts`
- `realtime-engine/src/security/jwt.ts`
- `frontend/next.config.mjs` (CSP)
