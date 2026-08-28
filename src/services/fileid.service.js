import { cache } from "./cache.service.js";
import fsSync from "fs";
import { CONFIG } from "../config/index.js";
import { BRAND } from "../config/branding.js";

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
 * Har bot rasmlari O'Z PAPKASIDA turadi (brenddagi `imageDir`):
 *   brandImage("assets/images/start.png")
 *     -> "assets/images/mega-filmlar/start.png"   Mega Filmlar uchun
 *     -> "assets/images/doda-kino/start.png"      papkasi yo'q botlar uchun
 *
 * Shu tufayli bitta kod bilan ishlayotgan botlar butunlay boshqa rasmlar
 * ko'rsata oladi — yangi bot uchun papka ochib rasmlarni tashlash va
 * brendga `imageDir` yozish kifoya.
 *
 * O'Z papkasi bo'lmagan (yoki papkasida shu rasm yo'q) bot DEFAULT_DIR dan
 * oladi — hozircha multik va anime botlar shunday ishlaydi, ular uchun
 * alohida rasmlar tayyor bo'lganda faqat `imageDir` qo'shiladi.
 *
 * Fayl nomi katta-kichik harf bo'yicha ham solishtiriladi: Linux buni
 * farqlaydi va "Icon.png" / "icon.png" mos kelmay qolardi.
 */
const IMAGES_ROOT = "assets/images";
const DEFAULT_DIR = "doda-kino";

const lookIn = (dir, fileName) => {
    const folder = `${IMAGES_ROOT}/${dir}`;
    try {
        const exact = `${folder}/${fileName}`;
        if (fsSync.existsSync(exact)) return exact;

        // Katta-kichik harf farq qilsa ham topamiz
        const lower = fileName.toLowerCase();
        const found = fsSync.readdirSync(folder).find((f) => f.toLowerCase() === lower);
        if (found) return `${folder}/${found}`;
    } catch { /* papka yo'q yoki o'qib bo'lmadi */ }
    return null;
};

export function brandImage(defaultPath) {
    const fileName = defaultPath.split("/").pop();

    for (const dir of [BRAND.imageDir, DEFAULT_DIR]) {
        if (!dir) continue;
        const found = lookIn(dir, fileName);
        if (found) return found;
    }

    return defaultPath;
}
