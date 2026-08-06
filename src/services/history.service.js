import { InputFile, InlineKeyboard } from "grammy";
import { cache } from "./cache.service.js";
import { parseTelegramMediaId } from "../utils/media.utils.js";
import { FileIdService } from "./fileid.service.js";

const HISTORY_TTL_SECONDS = 48 * 60 * 60; // 48 soat
const MAX_HISTORY_MESSAGES = 50; // Faqat oxirgi 50 ta epizod

const LOCKED_IMAGE_PATH = "assets/images/error.png";
const LOCKED_IMAGE_KEY = "locked_photo";

// Redis ishlamay qolganda yoki local test uchun zaxira xotira (RAM)
const memoryStore = new Map();
const MEMORY_STORE_MAX_USERS = 5000; // RAM cheksiz o'sib ketmasligi uchun

function getMemoryUserStore(userId) {
    if (!memoryStore.has(userId)) {
        // Limitga yetganda eng eski userni o'chiramiz (Map insertion-order)
        if (memoryStore.size >= MEMORY_STORE_MAX_USERS) {
            const oldestKey = memoryStore.keys().next().value;
            memoryStore.delete(oldestKey);
        }
        memoryStore.set(userId, { episodes: [], is_locked: false });
    }
    return memoryStore.get(userId);
}

export const HistoryService = {
    /**
     * Foydalanuvchiga yuborilgan epizod ID va ma'lumotlarini saqlaydi
     * @param {number} userId
     * @param {number} messageId - Telegram xabar ID si
     * @param {object} episodeData - { code, videoFileId, caption yoki episode obj }
     */
    async addMovieMessage(userId, messageId, episodeData) {
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
            } catch (error) {
                console.error("[HistoryService] addMovieMessage error:", error.message);
            }
        } else {
            const userStore = getMemoryUserStore(userId);
            userStore.episodes.unshift(data);
            if (userStore.episodes.length > MAX_HISTORY_MESSAGES) userStore.episodes.pop();
        }
    },

    /**
     * Kanaldan chiqqanda kinolarni qulflaydi (video -> rasm)
     */
    async lockUserMedia(ctx, userId) {
        let items = [];

        if (cache.isReady && cache.client) {
            const key = `user:${userId}:episodes`;
            const lockKey = `user:${userId}:is_locked`;
            try {
                const rawItems = await cache.client.lRange(key, 0, -1);
                if (!rawItems || rawItems.length === 0) return;
                items = rawItems.map(i => JSON.parse(i));
                await cache.client.set(lockKey, "1", { EX: HISTORY_TTL_SECONDS });
            } catch (e) {
                console.error("[HistoryService] lockUserMedia Redis error:", e.message);
                return;
            }
        } else {
            const userStore = memoryStore.get(userId);
            if (!userStore || userStore.episodes.length === 0) return;
            items = userStore.episodes;
            userStore.is_locked = true;
        }

        if (items.length === 0) return;

        const caption = `<b>🔒 KINO QULFLANDI</b>\n\n<blockquote>Siz majburiy kanallardan biridan chiqib ketganingiz sababli ushbu kino bloklandi.</blockquote>\n\n<i>Kinoni ko'rishda davom etish uchun pastdagi tugmalar orqali kanallarga qaytadan a'zo bo'ling!</i>`;

        let cachedLockedImageId = await FileIdService.get(LOCKED_IMAGE_KEY);

        for (const item of items) {
            try {
                const msg = await ctx.api.editMessageMedia(
                    userId,
                    item.messageId,
                    {
                        type: "photo",
                        media: cachedLockedImageId || new InputFile(LOCKED_IMAGE_PATH),
                        caption: caption,
                        parse_mode: "HTML"
                    },
                    { reply_markup: new InlineKeyboard() }
                );

                if (!cachedLockedImageId && msg.photo?.length > 0) {
                    cachedLockedImageId = msg.photo[msg.photo.length - 1].file_id;
                    FileIdService.set(LOCKED_IMAGE_KEY, cachedLockedImageId);
                }
            } catch (err) {
                // 48 soatdan oshgan yoki o'chirilgan xabar — o'tkazib yuborish
            }
        }
    },

    /**
     * Obuna bo'lganda kinolarni qayta ochadi (rasm -> video)
     */
    async unlockUserMedia(ctx, userId) {
        let items = [];

        if (cache.isReady && cache.client) {
            const lockKey = `user:${userId}:is_locked`;
            const key = `user:${userId}:episodes`;
            try {
                const isLocked = await cache.client.get(lockKey);
                if (!isLocked) return;
                const rawItems = await cache.client.lRange(key, 0, -1);
                if (!rawItems || rawItems.length === 0) return;
                items = rawItems.map(i => JSON.parse(i));
                await cache.client.del(lockKey);
            } catch (e) {
                console.error("[HistoryService] unlockUserMedia Redis error:", e.message);
                return;
            }
        } else {
            const userStore = memoryStore.get(userId);
            if (!userStore || !userStore.is_locked || userStore.episodes.length === 0) return;
            items = userStore.episodes;
            userStore.is_locked = false;
        }

        if (items.length === 0) return;

        for (const item of items) {
            if (!item.videoFileId) continue;

            const media = parseTelegramMediaId(item.videoFileId);
            if (!media || !media.fileId) continue;

            try {
                await ctx.api.editMessageMedia(
                    userId,
                    item.messageId,
                    {
                        type: "video",
                        media: media.fileId,
                        caption: item.caption || "",
                        parse_mode: "HTML"
                    },
                    { reply_markup: new InlineKeyboard().text("📃 Malumotlar", `episode_info_${item.code}`).style("primary") }
                );
            } catch (err) {
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
                            },
                            { reply_markup: new InlineKeyboard().text("📃 Malumotlar", `episode_info_${item.code}`).style("primary") }
                        );
                    } catch (docErr) {
                        // 48 soat o'tgan yoki boshqa xato
                    }
                }
            }
        }
    }
};
