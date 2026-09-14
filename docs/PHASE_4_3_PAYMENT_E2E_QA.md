# Spec: Phase 4.3 development payment E2E QA

## Objective

Provide one opt-in development command that exercises the current-generation payment lifecycle against MongoDB and GridFS: pending, proof submission, rejection, safe participant status, resubmission, simulated verification, metric/export isolation, duplicate reference protection, invalid transitions, and owned-data cleanup.

## Commands

- QA: `npm run dev:test-payment-e2e`
- Policy tests: `npm run test:payment-policy`
- Validation: `npm run lint && npm run typecheck && npm run build`

## Architecture

The command runs only when `NODE_ENV !== production` plus `REGISTRATION_PREVIEW=1`, `PAYMENT_UI_PREVIEW=1`, and `PAYMENT_E2E_PREVIEW=1`. It uses the same server-side payment-flow services, MongoDB registration collection, GridFS proof bucket, participant-status projection, and real-record predicate as application routes. It creates uniquely marked `schemaVersion: 2`, `isTest: true`, `environment: development` records and tracks their public IDs and proof IDs for cleanup.

## Boundaries

- Always: generate synthetic `.invalid` identities; verify each state atomically; clean only owned test records/proofs; emit no secrets, token values, connection strings, or raw proof data.
- Ask first: production execution, payment configuration changes, or dependencies.
- Never: create payable UPI data, touch real records, include test records in real metrics/exports, or use the harness in production.

## Success criteria

- One command completes reject → participant reason → resubmit → verify using MongoDB and GridFS.
- A failed assertion returns non-zero while `finally` cleanup still removes only generated test data.
- Test records contribute zero to real metrics and exports.
- Participant status projection excludes private notes, database IDs, proof IDs, and access-token hashes.

## Known limitation

The harness is backend integration QA; it does not replace browser accessibility or visual testing.
