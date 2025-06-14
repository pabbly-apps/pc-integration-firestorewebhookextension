/**
 * Firebase Cloud Functions (v2) for sending webhook notifications
 * on Firestore document creation, update, and deletion events.
 * 
 * This implementation uses Firestore triggers to capture document lifecycle events 
 * and sends structured JSON payloads via HTTP POST to a predefined webhook URL.
 */

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
        // Extract document path from the event
        const documentPath = event.document || "";
        const pathParts = documentPath.split('/');
        const documentId = pathParts[pathParts.length - 1] || "unknown";
        const collectionId = pathParts[pathParts.length - 2] || "unknown";
        
        // Create a clean path without the projects prefix
        const cleanPath = documentPath.replace(/^projects\/[^\/]+\/databases\/[^\/]+\/documents\//, '');
        
        const timestamp = new Date().toISOString();

        /**
         * Parse Firestore document data
         * @param {object} data - Document data from Firestore
         * @param {string} docId - Document ID
         * @returns {object} Parsed document data
         */
        const parseDocumentData = (data, docId) => {
            if (!data) return { id: docId };
            
            // If data is already in simple format, use it directly
            if (typeof data === 'object' && !data._fieldsProto) {
                return { id: docId, ...data };
            }
            
            // Handle Firestore's internal format
            const result = { id: docId };
            const fields = data._fieldsProto || data.fields || data;
            
            for (const [key, value] of Object.entries(fields)) {
                if (value && typeof value === 'object') {
                    // Handle different Firestore field types
                    if (value.stringValue !== undefined) {
                        result[key] = value.stringValue;
                    } else if (value.integerValue !== undefined) {
                        result[key] = parseInt(value.integerValue);
                    } else if (value.doubleValue !== undefined) {
                        result[key] = parseFloat(value.doubleValue);
                    } else if (value.booleanValue !== undefined) {
                        result[key] = value.booleanValue;
                    } else if (value.timestampValue !== undefined) {
                        result[key] = value.timestampValue;
                    } else if (value.nullValue !== undefined) {
                        result[key] = null;
                    } else if (value.arrayValue !== undefined) {
                        result[key] = value.arrayValue.values || [];
                    } else if (value.mapValue !== undefined) {
                        result[key] = value.mapValue.fields || {};
                    } else {
                        // Fallback for unknown types
                        const valueKeys = Object.keys(value);
                        result[key] = valueKeys.length > 0 ? value[valueKeys[0]] : value;
                    }
                } else {
                    result[key] = value;
                }
            }
            
            return result;
        };

        // Handle different event types
        if (eventType === "document_updated") {
            const beforeData = parseDocumentData(event.oldValue, documentId);
            const afterData = parseDocumentData(event.value, documentId);

            // Calculate changes
            const changes = {};
            const allKeys = new Set([...Object.keys(beforeData), ...Object.keys(afterData)]);
            
            for (const key of allKeys) {
                if (key === 'id') continue; // Skip ID field for changes
                
                const beforeValue = beforeData[key];
                const afterValue = afterData[key];
                
                if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
                    changes[key] = {
                        before: beforeValue,
                        after: afterValue
                    };
                }
            }

            return {
                eventType,
                documentPath: cleanPath,
                documentId,
                collectionId,
                timestamp,
                before: beforeData,
                after: afterData,
                changes
            };
        }

        // Handle create and delete events
        let documentData = {};
        if (eventType === "document_created" && event.value) {
            documentData = parseDocumentData(event.value, documentId);
        } else if (eventType === "document_deleted" && event.oldValue) {
            documentData = parseDocumentData(event.oldValue, documentId);
        }

        return {
            eventType,
            documentPath: cleanPath,
            documentId,
            collectionId,
            timestamp,
            data: documentData
        };
        
    } catch (error) {
        logger.error('Error transforming Firestore event:', error);
        return {
            eventType,
            error: 'Failed to transform event data',
            errorMessage: error.message,
            timestamp: new Date().toISOString()
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
            timeout: 15000, // 15 second timeout
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'Firebase-Extension-Pabbly-Webhook/1.0.0',
                'X-Firebase-Extension': 'firestore-webhook-connector-pabbly'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        
        logger.info(`Webhook sent successfully for ${eventType}: Status ${response.status}`);
        logger.debug(`Response data:`, response.data);
        
    } catch (error) {
        if (error.response) {
            logger.error(`Webhook server responded with an error for ${eventType}:`, {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        } else if (error.request) {
            logger.error(`No response received from webhook server for ${eventType}:`, {
                message: error.message,
                code: error.code
            });
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
    timeoutSeconds: 60,
    minInstances: 0
}, async (event) => {
    logger.info("onCreateWebhook function triggered", {
        document: event.document,
        eventId: event.eventId,
        eventTime: event.eventTime
    });
    
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
    timeoutSeconds: 60,
    minInstances: 0
}, async (event) => {
    logger.info("onUpdateWebhook function triggered", {
        document: event.document,
        eventId: event.eventId,
        eventTime: event.eventTime
    });
    
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
    timeoutSeconds: 60,
    minInstances: 0
}, async (event) => {
    logger.info("onDeleteWebhook function triggered", {
        document: event.document,
        eventId: event.eventId,
        eventTime: event.eventTime
    });
    
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