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
const WEBHOOK_URL = process.env.WEBHOOK_URL || "";
const DEFAULT_WILDCARD_PATH = "{collectionId}/{documentId}";
const CREATE_COLLECTION_PATH = process.env.CREATE_COLLECTION_PATH || DEFAULT_WILDCARD_PATH;
const DELETE_COLLECTION_PATH = process.env.DELETE_COLLECTION_PATH || DEFAULT_WILDCARD_PATH;
const UPDATE_COLLECTION_PATH = process.env.UPDATE_COLLECTION_PATH || DEFAULT_WILDCARD_PATH;

// Convert string values to boolean properly
const ENABLE_CREATE_WEBHOOK = (process.env.ENABLE_CREATE_WEBHOOK || "true").toLowerCase() === "true";
const ENABLE_DELETE_WEBHOOK = (process.env.ENABLE_DELETE_WEBHOOK || "true").toLowerCase() === "true";
const ENABLE_UPDATE_WEBHOOK = (process.env.ENABLE_UPDATE_WEBHOOK || "true").toLowerCase() === "true";

const LOCATION = process.env.LOCATION || "us-central1";
const DATABASE_NAME = process.env.DATABASE_NAME || "(default)";

/**
 * Validates webhook URL to ensure it's from allowed domains
 * @param {string} url - The webhook URL to validate
 * @returns {boolean} - True if URL is valid
 */
function isValidWebhookUrl(url) {
    if (!url) return false;
    
    try {
        const urlObj = new URL(url);
        const allowedDomains = ['connect.pabbly.com', 'webhook.site'];
        return allowedDomains.some(domain => 
            urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
        );
    } catch (error) {
        logger.error('Invalid webhook URL format:', error.message);
        return false;
    }
}

/**
 * Helper function to transform raw Firestore event data into a normalized format
 * suitable for webhook delivery.
 * 
 * @param {string} eventType - One of 'document_created', 'document_updated', 'document_deleted'.
 * @param {object} event - The raw event payload from Firestore trigger.
 * @returns {object} Normalized payload including document path, data, and timestamp.
 */
function transformFirestoreEvent(eventType, event) {
    try {
        const fullPath = event.value?.name || event.oldValue?.name || "";
        const path = fullPath.split("/documents/")[1] || "unknown";
        const segments = path.split("/");
        const id = segments[segments.length - 1];
        const timestamp = event.value?.updateTime || event.oldValue?.updateTime || new Date().toISOString();

        const parseFields = (fields = {}, docId) => {
            const result = { id: docId };
            for (const [key, val] of Object.entries(fields)) {
                if (val && typeof val === 'object') {
                    const type = Object.keys(val)[0];
                    result[key] = val[type];
                } else {
                    result[key] = val;
                }
            }
            return result;
        };

        // Handle document update diff structure
        if (eventType === "document_updated") {
            const before = parseFields(event.oldValue?.fields || {}, id);
            const after = parseFields(event.value?.fields || {}, id);

            const changes = {};
            for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
                if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
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

        // Handle create or delete events
        const fields = eventType === "document_created"
            ? parseFields(event.value?.fields || {}, id)
            : parseFields(event.oldValue?.fields || {}, id);

        return {
            eventType,
            documentPath: path,
            timestamp,
            data: fields
        };
    } catch (error) {
        logger.error('Error transforming Firestore event:', error);
        return {
            eventType,
            documentPath: "unknown",
            timestamp: new Date().toISOString(),
            error: 'Failed to transform event data',
            errorMessage: error.message
        };
    }
}

/**
 * Sends a JSON payload to the configured webhook URL.
 * Uses Axios with a timeout and comprehensive logging for observability.
 * 
 * @param {string} eventType - Type of Firestore event.
 * @param {object} eventPayload - JSON payload to be sent.
 */
async function sendWebhook(eventType, eventPayload) {
    if (!WEBHOOK_URL) {
        logger.warn(`No webhook URL configured. Skipping ${eventType} webhook.`);
        return;
    }

    if (!isValidWebhookUrl(WEBHOOK_URL)) {
        logger.error(`Invalid webhook URL: ${WEBHOOK_URL}. Only connect.pabbly.com and webhook.site domains are allowed.`);
        return;
    }

    logger.info(`Attempting to send webhook for ${eventType} event to ${WEBHOOK_URL}`);
    
    try {
        const response = await axios.post(WEBHOOK_URL, eventPayload, {
            timeout: 10000, // Increased timeout to 10 seconds
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'Firebase-Extension-Pabbly-Webhook/1.0.0'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        
        logger.info(`Webhook sent successfully for ${eventType}: Status ${response.status}`);
        logger.debug(`Sent Payload:`, JSON.stringify(eventPayload, null, 2));
        
    } catch (error) {
        if (error.response) {
            logger.error(`Webhook server responded with an error for ${eventType} (Status: ${error.response.status}):`, error.response.data);
        } else if (error.request) {
            logger.error(`No response received from webhook server for ${eventType} (Network error/Timeout)`);
        } else {
            logger.error(`Error setting up webhook request for ${eventType}:`, error.message);
        }
        
        // Don't throw error to prevent function failure
        return;
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
    memory: "256MiB",
    timeoutSeconds: 60
}, async (event) => {
    logger.info("onCreateWebhook function triggered.");
    logger.info("Full event object:", JSON.stringify(event, null, 2));

    if (!ENABLE_CREATE_WEBHOOK) {
        logger.info("Document creation webhook is disabled. Skipping execution.");
        return null;
    }

    try {
        const transformed = transformFirestoreEvent("document_created", event);
        await sendWebhook("document_created", transformed);
        logger.info("Create webhook processed successfully");
    } catch (error) {
        logger.error("Error in onCreateWebhook:", error);
    }
    
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
    memory: "256MiB",
    timeoutSeconds: 60
}, async (event) => {
    logger.info("onUpdateWebhook function triggered.");
    logger.info("Full event object:", JSON.stringify(event, null, 2));

    if (!ENABLE_UPDATE_WEBHOOK) {
        logger.info("Document update webhook is disabled. Skipping execution.");
        return null;
    }

    try {
        const transformed = transformFirestoreEvent("document_updated", event);
        await sendWebhook("document_updated", transformed);
        logger.info("Update webhook processed successfully");
    } catch (error) {
        logger.error("Error in onUpdateWebhook:", error);
    }
    
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
    memory: "256MiB",
    timeoutSeconds: 60
}, async (event) => {
    logger.info("onDeleteWebhook function triggered.");
    logger.info("Full event object:", JSON.stringify(event, null, 2));

    if (!ENABLE_DELETE_WEBHOOK) {
        logger.info("Document deletion webhook is disabled. Skipping execution.");
        return null;
    }

    try {
        const transformed = transformFirestoreEvent("document_deleted", event);
        await sendWebhook("document_deleted", transformed);
        logger.info("Delete webhook processed successfully");
    } catch (error) {
        logger.error("Error in onDeleteWebhook:", error);
    }
    
    return null;
});