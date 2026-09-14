# Registration Field Audit

This is an audit of the legacy five-step form, not a Phase 3 redesign.

| Field | Recommendation | Reason |
| --- | --- | --- |
| Full name, email, mobile | KEEP | Minimum identity and communication data. |
| WhatsApp | MAKE OPTIONAL | Collect only if it has a documented communication purpose. |
| Gender | REMOVE | No confirmed operational need. |
| College, student ID/PRN, branch, year | REVIEW | Eligibility is pending; collect only fields needed for confirmed eligibility/certificates. |
| Division | REMOVE | No established use. |
| Interests, startup idea, previous startup event | MAKE OPTIONAL | Useful research only with clear optional purpose. |
| Previous E-Cell IIT Bombay attendance | REMOVE | Unsupported and intrusive for registration. |
| Campus visit/travel interest | REMOVE UNTIL CONFIRMED | Benefit and selection criteria are pending. |
| Emergency contact | REVIEW | Collect only for a confirmed travel/off-site safety need. |
| Accessibility requirements | KEEP OPTIONAL | Supports inclusion; state purpose and handling. |
| Accuracy, terms, communications consent | REVIEW | Keep only legally/policy-supported consent; marketing must be separate opt-in. |
| UTR/reference ID, screenshot | KEEP IN PAYMENT STEP | Required for manual verification only after valid UPI details are confirmed. |

The legacy form stores a draft in localStorage and falls back to a browser-only registration list. Phase 3 must minimise data, define retention, and remove the local fallback for real submissions.
