import "dotenv/config";

export const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    // Telegram bot ID si — token boshidagi raqam. Backend multibot bo'lgani
    // uchun har so'rov /api/<BOT_ID>/... ko'rinishida yuboriladi va barcha
    // Redis kalitlari shu ID bilan prefikslanadi (botlar bitta Redis'ni
    // bo'lishadi, kalitlar aralashmasligi kerak).
    BOT_ID: String(process.env.BOT_TOKEN || "").split(":")[0],
    API_URL: process.env.API_URL,
    CHANNEL_ID: process.env.CHANNEL_ID,
    DUMP_CHANNEL: process.env.DUMP_CHANNEL,

    // Reklama kanali: admin shu yerga post tashlaydi, bot esa uni
    // foydalanuvchilarga tarqatishni taklif qiladi. Berilmasa reklama
    // oqimi butunlay o'chadi (bot boshqa ishlarini bajaraveradi).
    AD_CHANNEL_ID: process.env.AD_CHANNEL_ID || null,
    ITEMS_PER_PAGE: 12,
    REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",

    IS_PRODUCTION: process.env.NODE_ENV === "production",
    WEBHOOK_URL: process.env.WEBHOOK_URL || "https://dodakino.orbitx.uz/webhook",
    PORT: Number(process.env.PORT) || 5001,

    // Backend sekin bo'lsa ham bitta so'rov update'ni uzoq ushlab turmasin
    API_TIMEOUT_MS: 8000,

    CACHE_TTL: {
        FILM_BY_CODE: 300,
        EPISODE_BY_CODE: 300,
        ALL_FILMS: 120,
        SEARCH_RESULTS: 180,
    },

    SESSION_TTL_SECONDS: 7 * 24 * 60 * 60,
};

if (!CONFIG.BOT_TOKEN) {
    throw new Error("CRITICAL: BOT_TOKEN is missing in environment variables!");
}

// CHANNEL_ID ATAYLAB majburiy emas.
//
// Ilgari media yuklashni bot o'zi qilardi va kanalsiz ishlay olmasdi.
// Endi buni backend bajaradi, filmlar esa kanal ID sini o'z ichida
// saqlaydi ({channelId, msgId}) — ya'ni bot bu qiymatsiz ham to'liq
// ishlaydi. Yangi ochilgan botda kanal hali bo'lmasligi mumkin, shu
// sababli bu yerda "throw" o'rniga ogohlantirish qoldirildi.
if (!CONFIG.CHANNEL_ID) {
    console.warn("[Config] CHANNEL_ID berilmagan — media kanali sozlanmagan (bot baribir ishlaydi).");
}

export const SUBSCRIBED_STATUSES = ["member", "administrator", "creator"];

// Private kanallarda obuna tekshiruvidan ozod qilingan (bypass) userlar
export const PRIVATE_CHANNEL_BYPASS_IDS = new Set([
    748583274, 1555265395, 8222727492, 6919840656, 791067564,
]);

export function isPrivateBypassUser(channel, userId) {
    return Boolean(channel?.isPrivate) && PRIVATE_CHANNEL_BYPASS_IDS.has(userId);
}
