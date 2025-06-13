# 📦 Firestore Webhook Connector for Pabbly Connect – Post-Installation Guide

Thank you for installing the **Firestore Webhook Connector for Pabbly Connect** Extension!

This guide will help you verify the installation and start using your new extension to send Firestore event payloads to Pabbly Connect seamlessly.

---

## ✅ Verify Your Installation

1. **Confirm Extension Deployment**  
   Visit your Firebase Console → Extensions → Installed Extensions.  
   Check that the extension status shows **Active** with no errors.

2. **Check Configuration Parameters**  
   Make sure you provided the correct values during installation, especially your `WEBHOOK_URL` — it must be a valid and reachable Pabbly Connect webhook endpoint.

3. **Verify Firestore Paths**  
   Confirm the Firestore collection paths you want to monitor are correct and exist in your Firestore database.  
   - `CREATE_COLLECTION_PATH`  
   - `UPDATE_COLLECTION_PATH`  
   - `DELETE_COLLECTION_PATH`  

---

## 🛠️ Testing the Webhook Integration

Perform these actions in your Firestore console or via your app to trigger events:

- **Create a new document** in the configured `CREATE_COLLECTION_PATH`.
- **Update a document** in the `UPDATE_COLLECTION_PATH`.
- **Delete a document** in the `DELETE_COLLECTION_PATH`.

After each action, verify:

- Your Pabbly Connect webhook receives the JSON payload.
- The payload contains expected data, including before/after diffs for updates.

---

## 📋 Monitoring and Logs

To troubleshoot or confirm webhook calls:

1. Go to your Firebase Console → Functions → Logs.  
2. Filter logs by the extension function name (usually includes `firestoreWebhook`).  
3. Check for any errors or webhook call details.

---

## 🔄 Updating Your Configuration

If you need to change any parameters (e.g., webhook URL or collection paths):

1. Go to Firebase Console → Extensions → Your Installed Extension.  
2. Click **Update Configuration**.  
3. Modify your parameters and save.  

Note: Changes may take a few minutes to apply.

---

## 🚀 Next Steps & Tips

- **Create Pabbly Connect workflows** to automate processing of incoming Firestore events.
- Use the webhook payload data to trigger emails, update CRMs, notify teams, or sync with other services.
- Secure your Pabbly webhook URL to only accept trusted requests if possible.

---

If you have questions or need help, please consult the [official Firebase Extensions documentation](https://firebase.google.com/docs/extensions) or reach out to support at: [support@pabbly.com].

---

Thanks again for using the Firestore Webhook to Pabbly Connect extension!  
Happy automating! 🎉
