# 📦 Firestore to Pabbly Webhook – Pre-Installation Guide

This guide explains how to configure Firebase Firestore triggers for integration with Firestore Webhook Connector for Pabbly Connect using Pabbly Connect. These triggers listen for Firestore document changes and initiate corresponding actions automatically.

Before you proceed with the installation, please review the following important information to ensure a smooth setup.

---

## ⚙️ Prerequisites

- You must have a Firebase project with Firestore enabled.
- You should have admin access to your Firebase Console to install extensions.
- Make sure you have a valid **Pabbly Connect webhook URL** ready to receive webhook payloads.

---

## 🔑 Required Information

During installation, you will be asked to provide these parameters:

| Parameter Name              | Description                                                                 | Required | Example                                      |
|----------------------------|-----------------------------------------------------------------------------|----------|----------------------------------------------|
| `WEBHOOK_URL`              | Your **Pabbly Connect webhook endpoint** that will receive the payloads.    | ✅       | `https://connect.pabbly.com/workflow/send`  |
| `ENABLE_CREATE_WEBHOOK`    | Set to `true` to send webhooks when documents are created.                  | ✅       | `true`                                       |
| `ENABLE_UPDATE_WEBHOOK`    | Set to `true` to send webhooks on document updates.                         | ✅       | `true`                                       |
| `ENABLE_DELETE_WEBHOOK`    | Set to `true` to send webhooks on document deletions.                       | ✅       | `true`                                       |
| `CREATE_COLLECTION_PATH`   | Firestore path to monitor for creations (e.g. `{collectionId}/{documentId}`) | ❌       | `orders/{orderId}`                            |
| `UPDATE_COLLECTION_PATH`   | Firestore path to monitor for updates.                                      | ❌       | `orders/{orderId}`                            |
| `DELETE_COLLECTION_PATH`   | Firestore path to monitor for deletions.                                    | ❌       | `orders/{orderId}`                            |
| `LOCATION`                 | Region to deploy the cloud functions.                                       | ❌       | `us-central1`                                |

---

## 🔍 Important Considerations

- The extension requires your **Pabbly Connect Webhook URL** to accept HTTP POST requests with JSON payloads.
- Make sure the Firestore collections you want to monitor exist or will be created.
- The extension will incur Firebase Cloud Function and Firestore usage costs based on your activity.
- Ensure you understand your Firestore security rules, as this extension listens to document changes.

---

## 📋 Installation Tips

- Double-check your `WEBHOOK_URL` for correctness before installation.
- If you want to monitor multiple collections or specific paths, use Firestore path wildcards like `{collectionId}/{documentId}`.
- Choose the correct `LOCATION` closest to your Firestore data to reduce latency and costs.

---

If you have questions or need help, please consult the [official Firebase Extensions documentation](https://firebase.google.com/docs/extensions) or reach out to support at: [support@pabbly.com].

---

Once you have reviewed everything, proceed with the installation to enable real-time Firestore event webhooks to Pabbly Connect.

Happy automating! 🚀
