# Changelog

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
