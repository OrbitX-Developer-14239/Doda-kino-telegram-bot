import http from "http";
import https from "https";
import axios from "axios";
import { CONFIG } from "../config/index.js";
import { cache } from "./cache.service.js";
import { KEYS } from "./cache-keys.js";

const apiClient = axios.create({
    baseURL: CONFIG.API_URL + "/api",
    // Sekin backend bitta update'ni uzoq ushlab turmasligi kerak
    timeout: CONFIG.API_TIMEOUT_MS,
    // Backend endi barcha endpointlarni himoyalaydi, shuning uchun bot o'zini
    // har so'rovda tanitadi. Ilgari bu header faqat admin oqimlarida yuborilardi.
    headers: { "x-bot-token": CONFIG.BOT_TOKEN },
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
});

let _channelsCache = null;
let _channelsCacheTime = 0;
const CHANNELS_MEM_TTL = 30 * 1000;

// Bir xil so'rov parallel kelsa, backend'ga faqat bittasi boradi
const _inflight = new Map();

export const ApiService = {
    /**
     * Stale-while-revalidate kesh: muddati o'tgan bo'lsa ham keshdagi javob
     * DARHOL qaytariladi, yangilanish esa fonda ketadi. Shu tufayli birinchi
     * so'rov ham (Redis'da eski nusxa bo'lsa) sekundning ulushida javob oladi.
     */
    async _swrGet(cacheKey, ttlSeconds, fetcher) {
        const cached = await cache.get(cacheKey);

        if (cached && cached.__swr) {
            const ageSeconds = (Date.now() - cached.t) / 1000;
            if (ageSeconds > ttlSeconds) {
                this._swrRefresh(cacheKey, ttlSeconds, fetcher); // fonda yangilash
            }
            return cached.d;
        }

        if (cached) return cached; // eski formatdagi kesh — muddati bilan o'zi o'chadi

        return await this._swrRefresh(cacheKey, ttlSeconds, fetcher);
    },

    async _swrRefresh(cacheKey, ttlSeconds, fetcher) {
        if (_inflight.has(cacheKey)) return _inflight.get(cacheKey);

        const promise = (async () => {
            try {
                const data = await fetcher();
                if (data !== null && data !== undefined) {
                    // Redis'da TTL'dan ancha uzoq saqlaymiz — "stale" nusxa
                    // restart'dan keyin ham birinchi so'rovni tez qiladi
                    await cache.set(cacheKey, { __swr: true, t: Date.now(), d: data }, ttlSeconds * 10);
                }
                return data ?? null;
            } catch (error) {
                console.error(`[API] fetch error (${cacheKey}):`, error.message);
                return null;
            } finally {
                _inflight.delete(cacheKey);
            }
        })();

        _inflight.set(cacheKey, promise);
        return promise;
    },

    /**
     * Kesh versiyasi. Backend film/epizod o'zgarganda buni oshiradi.
     * Sessiyada saqlangan ro'yxat nusxasi shu raqam bilan belgilanadi —
     * raqam o'zgargan bo'lsa nusxa eskirgan, qayta olish kerak.
     */
    async getCacheVersion() {
        const v = await cache.getRaw(KEYS.version());
        return v ?? "0";
    },

    /**
     * Nom indeksi: `redis-cli KEYS "*"` chiqishida kino o'zbekcha nomi bilan
     * ko'rinib tursin. Qiymati — kod, ya'ni nomdan kodni topsa ham bo'ladi.
     * Asosiy o'qish baribir kod bo'yicha ketadi, bu faqat qo'shimcha indeks.
     */
    _indexName(keyFn, item, ttlSeconds) {
        if (!item?.name || item?.code === undefined || item?.code === null) return;
        cache.set(keyFn(item.name), item.code, ttlSeconds * 10).catch(() => { });
    },

    clearChannelsCache() {
        _channelsCache = null;
        _channelsCacheTime = 0;
        cache.del(KEYS.channels()).catch(() => { });
    },

    async getRequiredChannels() {
        if (_channelsCache && Date.now() - _channelsCacheTime < CHANNELS_MEM_TTL) {
            return _channelsCache;
        }

        if (_channelsCache) {
            this._fetchAndCacheChannels().catch(() => { });
            return _channelsCache;
        }

        return await this._fetchAndCacheChannels();
    },

    async _fetchAndCacheChannels() {
        const cacheKey = KEYS.channels();
        try {
            const response = await apiClient.get("/channel");
            const channelsArray = response.data?.data || [];

            _channelsCache = channelsArray;
            _channelsCacheTime = Date.now();
            await cache.set(cacheKey, channelsArray, 30);

            return channelsArray;
        } catch (error) {
            console.error("[API] fetch channels error:", error.message);
            _channelsCacheTime = Date.now() - CHANNELS_MEM_TTL + 15000;

            const cached = await cache.get(cacheKey);
            if (cached) {
                _channelsCache = cached;
                return cached;
            }
            return _channelsCache || [];
        }
    },

    async getAllFilms(page = 1) {
        return this._swrGet(KEYS.filmsPage(page), CONFIG.CACHE_TTL.ALL_FILMS, async () => {
            const response = await apiClient.get(`/film?page=${page}`);
            return response.data;
        });
    },

    async getFilmByCode(code) {
        return this._swrGet(KEYS.film(code), CONFIG.CACHE_TTL.FILM_BY_CODE, async () => {
            const response = await apiClient.get(`/film/code/${code}`);
            const film = response.data?.data;
            this._indexName(KEYS.filmName, film, CONFIG.CACHE_TTL.FILM_BY_CODE);
            return film;
        });
    },

    async searchFilm(query) {
        const cacheKey = KEYS.search(query);
        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        try {
            // AI qidiruv boshqa endpointlardan sekinroq — unga alohida timeout
            const response = await apiClient.post("/film/search", { query }, { timeout: 20000 });

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
        return this._swrGet(KEYS.episode(code), CONFIG.CACHE_TTL.EPISODE_BY_CODE, async () => {
            const response = await apiClient.get(`/episode/code/${code}`);
            const episode = response.data?.data;
            this._indexName(KEYS.episodeName, episode, CONFIG.CACHE_TTL.EPISODE_BY_CODE);
            return episode;
        });
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

    async linkAdminContact(contactData) {
        try {
            const response = await apiClient.post("/admin/telegram-link", contactData, {
                headers: {
                    "x-bot-token": CONFIG.BOT_TOKEN
                }
            });
            return response.data;
        } catch (error) {
            console.error("[API] admin/telegram-link error:", error.message);
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
        apiClient.post("/statistics/view", { type, code })
            .catch(err => console.error(`[API] addView error (${type} ${code}):`, err.message));
    }
};