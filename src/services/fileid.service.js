import { cache } from "./cache.service.js";
import fsSync from "fs";
import { CONFIG } from "../config/index.js";

const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 kun

// Telegram'ga bir marta yuklangan rasmlarning file_id'lari.
// DIQQAT: file_id BOT TOKENIGA bog'langan — bir botniki boshqasida ishlamaydi.
// Shuning uchun kalit bot ID prefiksi bilan saqlanadi.
// Avval modul darajasidagi o'zgaruvchilarda saqlanardi — har restart'da yo'qolib,
// birinchi user uchun rasm diskdan qaytadan yuklanardi (~1s kechikish).
// Endi Redis'da doimiy saqlanadi, RAM esa tezkor qatlam sifatida ishlaydi.
const mem = new Map();

export const FileIdService = {
    async get(name) {
        if (mem.has(name)) return mem.get(name);
        const value = await cache.get(`b${CONFIG.BOT_ID}:fileid:${name}`);
        if (value) mem.set(name, value);
        return value || null;
    },

    set(name, fileId) {
        if (!fileId) return;
        mem.set(name, fileId);
        // Fire-and-forget — javob tezligiga ta'sir qilmaydi
        cache.set(`b${CONFIG.BOT_ID}:fileid:${name}`, fileId, TTL_SECONDS);
    },
};

/**
 * Botga xos rasm yo'li.
 *
 * "assets/images/start.png" berilsa, avval "assets/images/start-<botId>.png"
 * qidiriladi — bor bo'lsa o'sha ishlatiladi. Shu tufayli bir xil kod bilan
 * ishlayotgan botlar HAR XIL rasm ko'rsatishi mumkin: yangi bot uchun
 * rasmlarni shu nom bilan tashlab qo'yish kifoya, kodga tegilmaydi.
 */
export function brandImage(defaultPath) {
    const dot = defaultPath.lastIndexOf(".");
    const perBot = `${defaultPath.slice(0, dot)}-${CONFIG.BOT_ID}${defaultPath.slice(dot)}`;
    try {
        if (fsSync.existsSync(perBot)) return perBot;
    } catch { /* fayl tizimi xatosi — umumiy rasm ishlatiladi */ }
    return defaultPath;
}
