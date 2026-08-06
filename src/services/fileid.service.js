import { cache } from "./cache.service.js";

const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 kun

// Telegram'ga bir marta yuklangan rasmlarning file_id'lari.
// Avval modul darajasidagi o'zgaruvchilarda saqlanardi — har restart'da yo'qolib,
// birinchi user uchun rasm diskdan qaytadan yuklanardi (~1s kechikish).
// Endi Redis'da doimiy saqlanadi, RAM esa tezkor qatlam sifatida ishlaydi.
const mem = new Map();

export const FileIdService = {
    async get(name) {
        if (mem.has(name)) return mem.get(name);
        const value = await cache.get(`fileid:${name}`);
        if (value) mem.set(name, value);
        return value || null;
    },

    set(name, fileId) {
        if (!fileId) return;
        mem.set(name, fileId);
        // Fire-and-forget — javob tezligiga ta'sir qilmaydi
        cache.set(`fileid:${name}`, fileId, TTL_SECONDS);
    },
};
