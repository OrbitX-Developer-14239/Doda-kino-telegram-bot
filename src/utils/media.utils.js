import { CONFIG } from "../config/index.js";

/**
 * Parses various formats of media identifiers (posterId, videoFileId) into a structured object for Telegram API.
 * Supports:
 * - "channelId:4389929267 msgId:4" or "channelId:-1004389929267 msgId:4"
 * - "-1004389929267:4" or "4389929267:4"
 * - 4 or "4" (legacy single message ID)
 * - { channelId, msgId } object
 * - Telegram cloud file_id string
 * 
 * @param {string|object|number} mediaInput
 * @returns {{ channelId?: string, msgId?: number, fileId?: string, isCopyable: boolean } | null}
 */
export function parseTelegramMediaId(mediaInput) {
    if (!mediaInput) return null;

    // Handle JSON object format { channelId, msgId }
    if (typeof mediaInput === "object") {
        const rawChannel = mediaInput.channelId || mediaInput.chatId;
        const rawMsg = mediaInput.msgId || mediaInput.messageId;
        
        if (rawChannel && rawMsg) {
            let channelId = String(rawChannel).trim();
            // Ensure channelId starts with -100 for Telegram copyMessage
            if (!channelId.startsWith("-100") && !channelId.startsWith("-")) {
                channelId = `-100${channelId}`;
            }
            return {
                channelId,
                msgId: Number(rawMsg),
                isCopyable: true
            };
        }
    }

    // If it's a string, maybe it's a direct fileId (e.g. from old data) or JSON string
    if (typeof mediaInput === "string") {
        try {
            const parsed = JSON.parse(mediaInput);
            if (parsed && typeof parsed === "object") {
                return parseTelegramMediaId(parsed);
            }
        } catch (e) {
            // Not JSON, assume it's a fallback fileId
        }

        const str = mediaInput.trim();
        // Fallback: Telegram file_id (e.g. "AgACAgIA...")
        return {
            fileId: str,
            isCopyable: false
        };
    }

    return null;
}

import { cache } from "../services/cache.service.js";
const fileIdCache = new Map();

export async function getOrExtractFileId(ctx, channelId, msgId) {
    const key = `fileid:${channelId}_${msgId}`;
    
    // 1. Check Memory Cache
    if (fileIdCache.has(key)) return fileIdCache.get(key);

    // 2. Check Redis Cache
    if (cache.isReady && cache.client) {
        try {
            const cached = await cache.client.get(key);
            if (cached) {
                fileIdCache.set(key, cached);
                return cached;
            }
        } catch(e) {}
    }

    // 3. Extract via DUMP_CHANNEL
    if (CONFIG.DUMP_CHANNEL) {
        try {
            const fwMsg = await ctx.api.forwardMessage(CONFIG.DUMP_CHANNEL, channelId, msgId, { disable_notification: true });
            let fileId = null;
            if (fwMsg.video) fileId = fwMsg.video.file_id;
            else if (fwMsg.document) fileId = fwMsg.document.file_id;
            
            await ctx.api.deleteMessage(CONFIG.DUMP_CHANNEL, fwMsg.message_id).catch(() => {});

            if (fileId) {
                fileIdCache.set(key, fileId);
                if (cache.isReady && cache.client) {
                    await cache.client.set(key, fileId, { EX: 30 * 24 * 60 * 60 }); // Cache for 30 days
                }
                return fileId;
            }
        } catch (err) {
            console.error("[media.utils] Failed to extract fileId via DUMP_CHANNEL:", err.message);
        }
    }
    
    return null;
}
