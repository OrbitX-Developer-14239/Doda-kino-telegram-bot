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
                    reconnectStrategy(retries) {
                        if (retries >= 3) {
                            console.warn("[Cache] Redis ulanmadi — cache'siz ishlaydi");
                            return false;
                        }
                        return Math.min(retries * 500, 2000);
                    },
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

            await this.client.connect();
        } catch (error) {
            console.warn("[Cache] Redis connection failed — cache'siz ishlaydi:", error.message);
            this.isReady = false;
            this.client = null;
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
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(keys);
            }
        } catch (error) {
            console.error("[Cache] DEL pattern error:", error.message);
        }
    }
}

export const cache = new CacheService();
