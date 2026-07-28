import http from "http";
import https from "https";
import axios from "axios";
import { CONFIG } from "../config/index.js";
import { cache } from "./cache.service.js";

const apiClient = axios.create({
    baseURL: CONFIG.API_URL + "/api",
    timeout: 20000,
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
});

let _channelsCache = null;
let _channelsCacheTime = 0;
const CHANNELS_MEM_TTL = 30 * 1000;

export const ApiService = {
    clearChannelsCache() {
        _channelsCache = null;
        _channelsCacheTime = 0;
        cache.del("channels_v2").catch(() => { });
    },

    async getRequiredChannels() {
        if (_channelsCache && Date.now() - _channelsCacheTime < CHANNELS_MEM_TTL) {
            return _channelsCache;
        }

        // Kesh eski bo'lsa ham tezlik uchun uni qaytaramiz va orqa fonda yangilaymiz (stale-while-revalidate)
        if (_channelsCache) {
            this._fetchAndCacheChannels().catch(() => { });
            return _channelsCache;
        }

        // Kesh umuman bo'lmasa, kutib olamiz (faqat birinchi zapuskda)
        return await this._fetchAndCacheChannels();
    },

    async _fetchAndCacheChannels() {
        const cacheKey = "channels_v2";
        try {
            const response = await apiClient.get("/channel");
            const channelsArray = response.data?.data || [];

            if (channelsArray.length >= 0) {
                _channelsCache = channelsArray;
                _channelsCacheTime = Date.now();
                await cache.set(cacheKey, channelsArray, 30);
            }

            return channelsArray;
        } catch (error) {
            console.error("[API] fetch channels error:", error.message);
            // Xatolik bo'lsa ham kesh vaqtini yangilaymiz (flooding oldini olish uchun, 15 soniyadan keyin yana urinadi)
            _channelsCacheTime = Date.now() - CHANNELS_MEM_TTL + 15000;

            // Keshdan urinib ko'ramiz
            const cached = await cache.get(cacheKey);
            if (cached) {
                _channelsCache = cached;
                return cached;
            }
            return _channelsCache || [];
        }
    },

    async getAllFilms(page = 1) {
        const cacheKey = `films:all:page:${page}`;
        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        try {
            const response = await apiClient.get(`/film?page=${page}`);
            const data = response.data;
            await cache.set(cacheKey, data, CONFIG.CACHE_TTL.ALL_FILMS);
            return data;
        } catch (error) {
            console.error("[API] getAllFilms error:", error.message);
            return null;
        }
    },

    async getFilmByCode(code) {
        const cacheKey = `film:code:${code}`;
        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        try {
            const response = await apiClient.get(`/film/code/${code}`);
            const data = response.data?.data;
            if (data) {
                await cache.set(cacheKey, data, CONFIG.CACHE_TTL.FILM_BY_CODE);
            }

            return data;
        } catch (error) {
            console.error("[API] getFilmByCode error:", error.message);
            return null;
        }
    },

    async searchFilm(query) {
        const cacheKey = `film:search:${query.toLowerCase().trim()}`;
        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        try {
            const response = await apiClient.post("/film/search", { query });

            const data = response.data?.data || [];
            if (data.length > 0) {
                await cache.set(cacheKey, data, CONFIG.CACHE_TTL.SEARCH_RESULTS);
            }
            return data;
        } catch (error) {
            console.error("[API] searchFilm error:", error.message);
            return [];
        }
    },

    async getEpisodeByCode(code) {
        const cacheKey = `episode:code:${code}`;
        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        try {
            const response = await apiClient.get(`/episode/code/${code}`);
            const data = response.data?.data;
            if (data) {
                await cache.set(cacheKey, data, CONFIG.CACHE_TTL.EPISODE_BY_CODE);
            }
            return data;
        } catch (error) {
            console.error("[API] getEpisodeByCode error:", error.message);
            return null;
        }
    },

    async saveToken(token, username) {
        try {
            const response = await apiClient.post("/bot/save", { token, username });
            return response.data;
        } catch (error) {
            console.error("[API] saveToken error:", error.message);
            throw error;
        }
    },

    async createUser(user) {
        try {
            const response = await apiClient.post("/user", user);
            return response.data;
        } catch (error) {
            console.error("[API] createUser error:", error.message);
            return null;
        }
    },

    async updateUser(telegram_id, channels_condition, first_name, username) {
        try {
            const response = await apiClient.put("/user", { telegram_id, channels_condition, first_name, username });
            return response.data;
        } catch (error) {
            console.error("[API] updateUser error:", error.message);
            return null;
        }
    },

    async updateAdmin(body) {
        try {
            const response = await apiClient.post("/admin/verify-bot", body, {
                headers: {
                    "x-bot-token": CONFIG.BOT_TOKEN
                }
            });
            return response.data;
        } catch (error) {
            console.error("[API] admin/verify-bot error:", error.message);
            return null;
        }
    },

    async checkAdminContact(contactData) {
        try {
            const response = await apiClient.post("/admin/telegram-login", contactData, {
                headers: {
                    "x-bot-token": CONFIG.BOT_TOKEN
                }
            });
            return response.data;
        } catch (error) {
            console.error("[API] admin/telegram-login error:", error.message);
            return null;
        }
    },

    async cancelAdminContact(authSessionToken) {
        try {
            await apiClient.post("/admin/telegram-login/cancel", { authSessionToken }, {
                headers: {
                    "x-bot-token": CONFIG.BOT_TOKEN
                }
            });
        } catch (error) {
            // Ignore error
        }
    },

    async authenticateAdminByTelegramToken(token) {
        try {
            const response = await apiClient.post("/admin/telegram-auth", { token });
            return response.data;
        } catch (error) {
            console.error("[API] admin/telegram-auth error:", error.message);
            return null;
        }
    },

    addView(type, code) {
        // Run in background without awaiting, to prevent blocking
        apiClient.post("/statistics/view", { type, code })
            .catch(err => console.error(`[API] addView error (${type} ${code}):`, err.message));
    }
};