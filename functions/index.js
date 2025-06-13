/**
 * Firebase Cloud Functions (v2) for sending webhook notifications
 * on Firestore document creation, update, and deletion events.
 * 
 * This implementation uses Firestore triggers to capture document lifecycle events and sends structured JSON payloads via HTTP POST to a predefined webhook URL.
 * 
 * The code is designed to be modular, configurable via environment variables, and production-ready with robust logging and error handling.
 */

// --- Import necessary Firebase Functions modules and external libraries ---
const logger = require("firebase-functions/logger");
const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const axios = require("axios");

// --- Load Environment Variables with Fallbacks ---
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://webhook.site/4f122b6e-d06f-4903-9df3-5a9b9ab1615d";
const DEFAULT_WILDCARD_PATH = "{collectionId}/{documentId}";
const CREATE_COLLECTION_PATH = process.env.CREATE_COLLECTION_PATH || DEFAULT_WILDCARD_PATH;
const DELETE_COLLECTION_PATH = process.env.DELETE_COLLECTION_PATH || DEFAULT_WILDCARD_PATH;
const UPDATE_COLLECTION_PATH = process.env.UPDATE_COLLECTION_PATH || DEFAULT_WILDCARD_PATH;

const ENABLE_CREATE_WEBHOOK = process.env.ENABLE_CREATE_WEBHOOK === "true";
const ENABLE_DELETE_WEBHOOK = process.env.ENABLE_DELETE_WEBHOOK === "true";
const ENABLE_UPDATE_WEBHOOK = process.env.ENABLE_UPDATE_WEBHOOK === "true";

const LOCATION = process.env.LOCATION || "us-central1";
const DATABASE_NAME = process.env.DATABASE_NAME || "(default)";


/**
 * Helper function to transform raw Firestore event data into a normalized format
 * suitable for webhook delivery.
 * 
 * @param {string} eventType - One of 'document_created', 'document_updated', 'document_deleted'.
 * @param {object} event - The raw event payload from Firestore trigger.
 * @returns {object} Normalized payload including document path, data, and timestamp.
 */
function transformFirestoreEvent(eventType, event) {
    const fullPath = event.value?.name || event.oldValue?.name || "";
    const path = fullPath.split("/documents/")[1] || "unknown";
    const segments = path.split("/");
    const id = segments[segments.length - 1];
    const timestamp = event.value?.updateTime || event.oldValue?.updateTime || new Date().toISOString();

    const parseFields = (fields = {}, docId) => {
        const result = { id: docId };
        for (const [key, val] of Object.entries(fields)) {
            const type = Object.keys(val)[0];
            result[key] = val[type];
        }
        return result;
    };

    // Handle document update diff structure
    if (eventType === "document_updated") {
        const before = parseFields(event.oldValue?.fields || {}, id);
        const after = parseFields(event.value?.fields || {}, id);

        const changes = {};
        for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
            if (before[key] !== after[key]) {
                changes[key] = after[key];
            }
        }

        return {
            eventType,
            documentPath: path,
            timestamp,
            before,
            after,
            changes
        };
    }

    //Handle create or delete events
    const fields = eventType === "document_created"
        ? parseFields(event.value?.fields || {}, id)
        : parseFields(event.oldValue?.fields || {}, id);

    return {
        eventType,
        documentPath: path,
        timestamp,
        data: fields
    };
}

/**
 * Sends a JSON payload to the configured webhook URL.
 * Uses Axios with a timeout and comprehensive logging for observability.
 * 
 * @param {string} eventType - Type of Firestore event.
 * @param {object} eventPayload - JSON payload to be sent.
 */
async function sendWebhook(eventType, eventPayload) {
    logger.info(`Attempting to send webhook for ${eventType} event to ${WEBHOOK_URL}`);
    try {
        const response = await axios.post(WEBHOOK_URL, eventPayload, {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' }
        });
        logger.info(`Webhook sent successfully for ${eventType}: Status ${response.status}`);
        logger.debug(`Sent Payload:`, JSON.stringify(eventPayload, null, 2));
    } catch (error) {
        if (error.response) {
            logger.error(`Webhook server responded with an error for ${eventType} (Status: ${error.response.status}):`, error.response.data);
        } else if (error.request) {
            logger.error(`No response received from webhook server for ${eventType} (Network error/Timeout):`, error.request);
        } else {
            logger.error(`Error setting up webhook request for ${eventType}:`, error.message);
        }
    }
}

/**
 * Triggered when a Firestore document is created.
 * Transforms the event and conditionally sends a webhook if enabled.
 */
exports.onCreateWebhook = onDocumentCreated({
    document: CREATE_COLLECTION_PATH,
    region: LOCATION,
    database: DATABASE_NAME,
    maxInstances: 10,
}, async (event) => {
    logger.info("onCreateWebhook function triggered.");
    logger.info("Full event object:", JSON.stringify(event, null, 2));

    if (!ENABLE_CREATE_WEBHOOK) {
        logger.info("Document creation webhook is disabled. Skipping execution.");
        return null;
    }

    const transformed = transformFirestoreEvent("document_created", event);
    await sendWebhook("document_created", transformed);
    return null;
});

/**
 * Triggered when a Firestore document is updated.
 * Computes the diff and sends it to the webhook endpoint.
 */
exports.onUpdateWebhook = onDocumentUpdated({
    document: UPDATE_COLLECTION_PATH,
    region: LOCATION,
    database: DATABASE_NAME,
    maxInstances: 10,
}, async (event) => {
    logger.info("onUpdateWebhook function triggered.");
    logger.info("Full event object:", JSON.stringify(event, null, 2));

    if (!ENABLE_UPDATE_WEBHOOK) {
        logger.info("Document update webhook is disabled. Skipping execution.");
        return null;
    }

    const transformed = transformFirestoreEvent("document_updated", event);
    await sendWebhook("document_updated", transformed);
    return null;
});

/**
 * Triggered when a Firestore document is deleted.
 * Sends the deleted document data to the webhook endpoint.
 */
exports.onDeleteWebhook = onDocumentDeleted({
    document: DELETE_COLLECTION_PATH,
    region: LOCATION,
    database: DATABASE_NAME,
    maxInstances: 10,
}, async (event) => {
    logger.info("onDeleteWebhook function triggered.");
    logger.info("Full event object:", JSON.stringify(event, null, 2));

    if (!ENABLE_DELETE_WEBHOOK) {
        logger.info("Document deletion webhook is disabled. Skipping execution.");
        return null;
    }

    const transformed = transformFirestoreEvent("document_deleted", event);
    await sendWebhook("document_deleted", transformed);
    return null;
});

