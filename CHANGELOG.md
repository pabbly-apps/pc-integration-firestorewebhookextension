# Changelog

## 0.1.4 - Fixed IAM role definitions and updated pricing URL
- Fixed invalid IAM role references by removing the `roles/roles/` prefix.
- Switched to short-form role names (`datastore.user`, `cloudfunctions.invoker`, `secretmanager.secretAccessor`) to meet Firebase validation requirements.
- Added `secretmanager.secretAccessor` role to enable access to stored webhook secrets.
- Updated `pricingUri` to point to the official Pabbly Connect pricing page.
- No functional/code changes.

## 0.1.3 - Fixed external service metadata validation
- Added `pricingUri` field to external services (`Pabbly Connect Webhook` and `Webhook.site`) to meet Firebase Extension publishing requirements.
- No functional/code changes.

## 0.1.2 - 2025-06-17
- Declared `https://connect.pabbly.com` and `https://webhook.site` in `externalServices` to meet Firebase review requirements.
- Marked `WEBHOOK_URL` as a `secret` with domain validation.
- Added required IAM roles: `roles/datastore.user` and `roles/cloudfunctions.invoker`.
- Bumped version to `0.1.2`.

## 0.1.1 - First stable release
- Marked `0.1.1` as the first stable release.
- Same feature set as `0.1.0-beta`, no code changes.

## 0.1.0 - Initial Release
- Introduced Firestore Webhook Connector extension for Pabbly Connect.
- Sends webhook POST requests automatically when Firestore documents are created, updated, or deleted.
- Supports configurable Firestore document paths and event types (create, update, delete).
- Allows enabling/disabling webhook notifications per event type.
- Includes Cloud Functions deployed with Node.js 20 runtime.
- Validates webhook URLs to allow only https://connect.pabbly.com and https://webhook.site domains.
