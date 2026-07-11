import "dotenv/config";

export const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    API_URL: process.env.API_URL,
    CHANNEL_ID: process.env.CHANNEL_ID,
    ITEMS_PER_PAGE: 12,
    REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",

    CACHE_TTL: {
        FILM_BY_CODE: 300,
        EPISODE_BY_CODE: 300,
        ALL_FILMS: 120,
        SEARCH_RESULTS: 180,
    },
};

if (!CONFIG.BOT_TOKEN) {
    throw new Error("CRITICAL: BOT_TOKEN is missing in environment variables!");
}

if (!CONFIG.CHANNEL_ID) {
    throw new Error("CRITICAL: CHANNEL_ID is missing in environment variables!");
}

export const SUBSCRIBED_STATUSES = ["member", "administrator", "creator"];