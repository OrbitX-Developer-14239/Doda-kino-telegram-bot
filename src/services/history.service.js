import { InputFile } from "grammy";
import { cache } from "./cache.service.js";
import { parseTelegramMediaId } from "../utils/media.utils.js";
import { getEpisodeCaption } from "../utils/text.utils.js";

const HISTORY_TTL_SECONDS = 48 * 60 * 60; // 48 soat
const MAX_HISTORY_MESSAGES = 50; // Faqat oxirgi 50 ta epizod

const LOCKED_IMAGE_PATH = "assets/images/error.png";
let cachedLockedImageId = null;

// Redis ishlamay qolganda yoki local test uchun zaxira xotira (RAM)
const memoryStore = new Map();

export const HistoryService = {
    /**
     * Foydalanuvchiga yuborilgan epizod ID va ma'lumotlarini saqlaydi
     * @param {number} userId
     * @param {number} messageId - Telegram xabar ID si
     * @param {object} episodeData - { code, videoFileId, caption yoki episode obj }
     */
    async addMovieMessage(userId, messageId, episodeData) {
        console.log(`[HistoryService] addMovieMessage called for userId: ${userId}, messageId: ${messageId}`);
        const data = {
            messageId,
            code: episodeData.code,
            videoFileId: episodeData.videoFileId,
            caption: episodeData.caption || ""
        };
        
        if (cache.isReady && cache.client) {
            const key = `user:${userId}:episodes`;
            try {
                await cache.client.lPush(key, JSON.stringify(data));
                await cache.client.lTrim(key, 0, MAX_HISTORY_MESSAGES - 1);
                await cache.client.expire(key, HISTORY_TTL_SECONDS);
                console.log(`[HistoryService] addMovieMessage saved to Redis for userId: ${userId}`);
            } catch (error) {
                console.error("[HistoryService] addMovieMessage error:", error.message);
            }
        } else {
            if (!memoryStore.has(userId)) memoryStore.set(userId, { episodes: [], is_locked: false });
            const userStore = memoryStore.get(userId);
            userStore.episodes.unshift(data);
            if (userStore.episodes.length > MAX_HISTORY_MESSAGES) userStore.episodes.pop();
            console.log(`[HistoryService] addMovieMessage saved to memoryStore for userId: ${userId}. Total episodes: ${userStore.episodes.length}`);
        }
    },

    /**
     * Kanaldan chiqqanda kinolarni qulflaydi (video -> rasm)
     */
    async lockUserMedia(ctx, userId) {
        console.log(`[HistoryService] Attempting to lock media for userId: ${userId}`);
        let items = [];
        
        if (cache.isReady && cache.client) {
            const key = `user:${userId}:episodes`;
            const lockKey = `user:${userId}:is_locked`;
            try {
                const rawItems = await cache.client.lRange(key, 0, -1);
                if (!rawItems || rawItems.length === 0) {
                     console.log(`[HistoryService] No items to lock in Redis for userId: ${userId}`);
                     return;
                }
                items = rawItems.map(i => JSON.parse(i));
                await cache.client.set(lockKey, "1", { EX: HISTORY_TTL_SECONDS });
                console.log(`[HistoryService] Fetched ${items.length} items from Redis to lock for userId: ${userId}`);
            } catch (e) {
                console.error("[HistoryService] lockUserMedia Redis error:", e.message);
                return;
            }
        } else {
            const userStore = memoryStore.get(userId);
            if (!userStore || userStore.episodes.length === 0) {
                console.log(`[HistoryService] No items to lock in memoryStore for userId: ${userId}`);
                return;
            }
            items = userStore.episodes;
            userStore.is_locked = true;
            console.log(`[HistoryService] Fetched ${items.length} items from memoryStore to lock for userId: ${userId}`);
        }

        if (items.length === 0) return;

        const caption = `<b>🔒 KINO QULFLANDI</b>\n\n<blockquote>Siz majburiy kanallardan biridan chiqib ketganingiz sababli ushbu kino bloklandi.</blockquote>\n\n<i>Kinoni ko'rishda davom etish uchun pastdagi tugmalar orqali kanallarga qaytadan a'zo bo'ling!</i>`;

        const lockMedia = cachedLockedImageId || new InputFile(LOCKED_IMAGE_PATH);

        for (const item of items) {
            console.log(`[HistoryService] Locking messageId ${item.messageId}`);
            try {
                const msg = await ctx.api.editMessageMedia(
                    userId, 
                    item.messageId, 
                    {
                        type: "photo",
                        media: lockMedia,
                        caption: caption,
                        parse_mode: "HTML"
                    }
                );
                console.log(`[HistoryService] Locked messageId ${item.messageId}`);
                
                if (!cachedLockedImageId && msg.photo?.length > 0) {
                    cachedLockedImageId = msg.photo[msg.photo.length - 1].file_id;
                }
            } catch (err) {
                 console.error(`[HistoryService] Error locking messageId ${item.messageId}:`, err.message);
                // 48 soatdan oshgan yoki o'chirilgan xabar — o'tkazib yuborish
            }
        }
    },

    /**
     * Obuna bo'lganda kinolarni qayta ochadi (rasm -> video)
     */
    async unlockUserMedia(ctx, userId) {
        console.log(`[HistoryService] Attempting to unlock media for userId: ${userId}`);
        let items = [];
        
        if (cache.isReady && cache.client) {
            const lockKey = `user:${userId}:is_locked`;
            const key = `user:${userId}:episodes`;
            try {
                const isLocked = await cache.client.get(lockKey);
                console.log(`[HistoryService] Redis isLocked status for ${userId}:`, isLocked);
                if (!isLocked) return;
                const rawItems = await cache.client.lRange(key, 0, -1);
                console.log(`[HistoryService] Redis rawItems count for ${userId}:`, rawItems?.length);
                if (!rawItems || rawItems.length === 0) return;
                items = rawItems.map(i => JSON.parse(i));
                await cache.client.del(lockKey);
            } catch (e) {
                console.error("[HistoryService] unlockUserMedia Redis error:", e.message);
                return;
            }
        } else {
            const userStore = memoryStore.get(userId);
            console.log(`[HistoryService] memoryStore status for ${userId}:`, userStore ? "Found" : "Not Found");
            if (userStore) console.log(`[HistoryService] memoryStore is_locked:`, userStore.is_locked, `episodes:`, userStore.episodes.length);
            if (!userStore || !userStore.is_locked || userStore.episodes.length === 0) return;
            items = userStore.episodes;
            userStore.is_locked = false;
        }

        console.log(`[HistoryService] Found ${items.length} items to unlock for ${userId}`);
        if (items.length === 0) return;

        for (const item of items) {
            if (!item.videoFileId) {
                 console.log(`[HistoryService] Missing videoFileId for messageId ${item.messageId}`);
                 continue;
            }
            
            const media = parseTelegramMediaId(item.videoFileId);
            if (!media || !media.fileId) {
                console.log(`[HistoryService] Could not parse media for videoFileId: ${JSON.stringify(item.videoFileId)}`);
                continue;
            }

            console.log(`[HistoryService] Unlocking messageId ${item.messageId} to video/document`);
            try {
                await ctx.api.editMessageMedia(
                    userId,
                    item.messageId,
                    {
                        type: "video",
                        media: media.fileId,
                        caption: item.caption || "",
                        parse_mode: "HTML"
                    }
                );
                console.log(`[HistoryService] Unlocked messageId ${item.messageId} as video`);
            } catch (err) {
                console.error(`[HistoryService] Error unlocking as video for messageId ${item.messageId}:`, err.message);
                // Agar video sifatida tahrirlab bo'lmasa, document sifatida sinash
                if (err.message && err.message.includes("can't be edited")) {
                    try {
                        await ctx.api.editMessageMedia(
                            userId,
                            item.messageId,
                            {
                                type: "document",
                                media: media.fileId,
                                caption: item.caption || "",
                                parse_mode: "HTML"
                            }
                        );
                        console.log(`[HistoryService] Unlocked messageId ${item.messageId} as document`);
                    } catch (docErr) {
                         console.error(`[HistoryService] Error unlocking as document for messageId ${item.messageId}:`, docErr.message);
                        // 48 soat o'tgan yoki boshqa xato
                    }
                }
            }
        }
    }
};
