import { session } from "grammy";
import { cache } from "../services/cache.service.js";
import { CONFIG } from "../config/index.js";
import { KEYS } from "../services/cache-keys.js";

/**
 * Sessiyada faqat FOYDALANUVCHIGA XOS holat saqlanadi.
 *
 * Film/epizod ma'lumotlarining nusxasi ATAYLAB yo'q: ilgari bu yerda
 * `active_film`, `active_episode` va `films[]` to'liq obyektlar turardi —
 * o'lchangan sessiya 4.7 KB bo'lib, shundan 96% i takroriy nusxa edi
 * (32 000 foydalanuvchida ~150 MB). Bundan tashqari admin filmni
 * tahrirlaganda o'sha nusxalar eskirib qolardi.
 *
 * Endi faqat kod saqlanadi, ma'lumot umumiy Redis keshidan o'qiladi.
 */
export function createInitialSession() {
    return {
        step: "idle",
        step_at: 0,
        active_film_id: null,
        active_episode_code: null,
        searchQuery: "",
        page: 1,
        totalPages: 1,
        subscription: {},
        admin: {
            verified: false,
            phoneNumber: null,
            userId: null,
            verifiedAt: null,
        },
    };
}

// Redis ishlamay qolgan payt uchun zaxira (TTL bilan — RAM leak bo'lmasligi uchun)
const FALLBACK_TTL_MS = 6 * 60 * 60 * 1000; // 6 soat
const memoryFallback = new Map();

const sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryFallback) {
        if (now - entry.touchedAt > FALLBACK_TTL_MS) memoryFallback.delete(key);
    }
}, 10 * 60 * 1000);
sweepTimer.unref?.();

/**
 * Session storage: asosiy manba — Redis (restart va scale'ga chidamli),
 * Redis o'chiq bo'lsa vaqtinchalik RAM fallback ishlaydi.
 */
const redisSessionStorage = {
    _key(key) {
        // Bot ID prefiksi bilan — 3 ta bot bitta Redis'ni bo'lishadi,
        // bir foydalanuvchi ikki botda yozishsa sessiyalari aralashmasin
        return KEYS.session(key);
    },

    async read(key) {
        if (cache.isReady && cache.client) {
            try {
                const raw = await cache.client.get(this._key(key));
                if (raw) return JSON.parse(raw);
            } catch (error) {
                console.error("[Session] read error:", error.message);
            }
        }
        const entry = memoryFallback.get(key);
        if (entry) {
            entry.touchedAt = Date.now();
            return entry.value;
        }
        return undefined;
    },

    async write(key, value) {
        if (cache.isReady && cache.client) {
            try {
                await cache.client.set(this._key(key), JSON.stringify(value), {
                    EX: CONFIG.SESSION_TTL_SECONDS,
                });
                memoryFallback.delete(key);
                return;
            } catch (error) {
                console.error("[Session] write error:", error.message);
            }
        }
        memoryFallback.set(key, { value, touchedAt: Date.now() });
    },

    async delete(key) {
        memoryFallback.delete(key);
        if (cache.isReady && cache.client) {
            try {
                await cache.client.del(this._key(key));
            } catch (error) {
                console.error("[Session] delete error:", error.message);
            }
        }
    },
};

export const sessionMiddleware = session({
    initial: createInitialSession,
    storage: redisSessionStorage,
});
