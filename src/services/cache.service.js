import { createClient } from "redis";
import { CONFIG } from "../config/index.js";

class CacheService {
    constructor() {
        this.client = null;
        this.isReady = false;
    }

    async connect() {
        try {
            this.client = createClient({
                url: CONFIG.REDIS_URL,
                socket: {
                    // Hech qachon taslim bo'lmaydi — Redis qaytishi bilan cache tiklanadi.
                    // Ulanish yo'q paytda get/set isReady orqali darhol o'tkazib yuboriladi.
                    reconnectStrategy: (retries) => Math.min(retries * 200, 5000),
                    connectTimeout: 3000,
                },
            });

            this.client.on("error", (err) => {
                if (this.isReady) {
                    console.error("[Cache] Redis error:", err.message);
                }
                this.isReady = false;
            });

            this.client.on("ready", () => {
                console.log("[Cache] Redis connected ✅");
                this.isReady = true;
            });

            this.client.on("end", () => {
                this.isReady = false;
            });

            // Redis o'chiq bo'lsa ham bot startupini bloklamaymiz:
            // ulanish fonda davom etadi, "ready" bo'lganda cache o'z-o'zidan yoqiladi.
            await Promise.race([
                this.client.connect(),
                new Promise((resolve) => setTimeout(resolve, 5000)),
            ]);

            if (!this.isReady) {
                console.warn("[Cache] Redis hali ulanmadi — fonda qayta urinishda davom etadi");
            }
        } catch (error) {
            console.warn("[Cache] Redis connection failed — cache'siz ishlaydi:", error.message);
            this.isReady = false;
        }
    }

    async get(key) {
        if (!this.isReady || !this.client) return null;
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error("[Cache] GET error:", error.message);
            return null;
        }
    }
    async set(key, value, ttlSeconds) {
        if (!this.isReady || !this.client) return;
        try {
            await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
        } catch (error) {
            console.error("[Cache] SET error:", error.message);
        }
    }

    async del(key) {
        if (!this.isReady || !this.client) return;
        try {
            await this.client.del(key);
        } catch (error) {
            console.error("[Cache] DEL error:", error.message);
        }
    }

    async delByPattern(pattern) {
        if (!this.isReady || !this.client) return;
        try {
            // KEYS o'rniga SCAN — katta bazada Redis'ni bloklamaydi
            for await (const chunk of this.client.scanIterator({ MATCH: pattern, COUNT: 200 })) {
                const keys = Array.isArray(chunk) ? chunk : [chunk];
                if (keys.length > 0) {
                    await this.client.del(keys);
                }
            }
        } catch (error) {
            console.error("[Cache] DEL pattern error:", error.message);
        }
    }
}

export const cache = new CacheService();
