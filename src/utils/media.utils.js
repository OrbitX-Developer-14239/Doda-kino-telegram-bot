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

    // Handle JSON object format
    if (typeof mediaInput === "object") {
        const rawChannel = mediaInput.channelId || mediaInput.chatId;
        const rawMsg = mediaInput.msgId || mediaInput.messageId;
        if (rawChannel && rawMsg) {
            let channelId = String(rawChannel).trim();
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

    const str = String(mediaInput).trim();

    // Check for "channelId:4389929267 msgId:4" or "channelId: 4389929267, msgId: 4" pattern
    const namedPatternMatch = str.match(/channelId:?\s*(-?\d+)\D+msgId:?\s*(\d+)/i);
    if (namedPatternMatch) {
        let channelId = namedPatternMatch[1];
        const msgId = Number(namedPatternMatch[2]);
        if (!channelId.startsWith("-100") && !channelId.startsWith("-")) {
            channelId = `-100${channelId}`;
        }
        return { channelId, msgId, isCopyable: true };
    }

    // Check for simple colon separated format: "-1004389929267:4" or "4389929267:4"
    if (str.includes(":")) {
        const parts = str.split(":");
        if (parts.length === 2) {
            let channelId = parts[0].trim();
            const msgIdStr = parts[1].trim();

            if (channelId && /^\d+$/.test(msgIdStr)) {
                if (!channelId.startsWith("-100") && !channelId.startsWith("-")) {
                    channelId = `-100${channelId}`;
                }
                return {
                    channelId,
                    msgId: Number(msgIdStr),
                    isCopyable: true
                };
            }
        }
    }

    // Check for legacy numeric message ID e.g. "4"
    if (/^\d+$/.test(str)) {
        return {
            channelId: CONFIG.CHANNEL_ID,
            msgId: Number(str),
            isCopyable: true
        };
    }

    // Fallback: Telegram file_id (e.g. "AgACAgIA...")
    return {
        fileId: str,
        isCopyable: false
    };
}
