import axios from "axios";
import { CONFIG } from "../config/index.js";
import { cache } from "./cache.service.js";

const apiClient = axios.create({
    baseURL: CONFIG.API_URL + "/api",
    timeout: 20000,
});

export const ApiService = {
    async getRequiredChannels() {
        const cacheKey = "channels_v2";
        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        try {
            const response = await apiClient.get("/channel");
            const channelsArray = response.data?.data || [];

            if (channelsArray.length > 0) {
                await cache.set(cacheKey, channelsArray, CONFIG.CACHE_TTL.CHANNELS);
            }

            return channelsArray;
        } catch (error) {
            console.error("[API] getRequiredChannels error:", error.message);
            return [];
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
            return null;
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

    async updateUser(telegram_id, channels_condition) {
        try {
            const response = await apiClient.put("/user", { telegram_id, channels_condition });
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

    async authenticateAdminByTelegramToken(token) {
        try {
            const response = await apiClient.post("/admin/telegram-auth", { token });
            return response.data;
        } catch (error) {
            console.error("[API] admin/telegram-auth error:", error.message);
            return null;
        }
    }
};