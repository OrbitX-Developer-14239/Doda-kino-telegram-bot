import fs from "fs";
const norm = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const must = (s, a, f) => { if (!s.includes(a)) { console.log(`XATO ${f}: ${a.slice(0, 70)}`); process.exit(1); } };

// ── branding: 4-bot (Mega Filmlar) ──
let s = norm("src/config/branding.js");

must(s, `    // ── 2-bot: @doda_multik_bot ──`, "branding");
s = s.replace(`    // ── 2-bot: @doda_multik_bot ──`,
`    // ── 4-bot: @mega_filmlar_bot ──
    // FILMLARI 1-bot bilan UMUMIY (bitta baza), faqat nomi, matnlari va
    // rasmlari boshqa. Shuning uchun so'zlari ham "film" bo'lib qoladi.
    "8829216136": {
        name: "Mega Filmlar",
        emoji: "🎞",
        item: "film",
        Item: "Film",
        plural: "filmlar",
        listCommand: "films",
        startLines: "• Yangi va mashhur filmlar\\n• Seriallar to'liq to'plami\\n• Yuqori sifatli videolar\\n• Sun'iy intellektli qidiruv",
        searchExamples: \`• "Interstellar"\\n• "Kemasi cho'kib ketadigan sevgi filmi."\\n• "Sehrgarlar maktabidagi bola."\\n• "Bosh qahramoni John Wick."\`,
        uz: "kinolarni", ru: "фильмы", en: "movies",
        worldUz: "kinolar olamiga", worldRu: "в мир кино", worldEn: "the world of cinema",
    },

    // ── 2-bot: @doda_multik_bot ──`);
fs.writeFileSync("src/config/branding.js", s);
console.log("OK branding");

// ── Rasmlar: har botga o'zinikini qo'yish imkoni ──
// "assets/images/start-<botId>.png" bo'lsa o'sha, bo'lmasa umumiy "start.png".
s = norm("src/services/fileid.service.js");
must(s, `import { CONFIG } from "../config/index.js";`, "fileid import");
s = s.replace(`import { CONFIG } from "../config/index.js";`,
`import fsSync from "fs";
import { CONFIG } from "../config/index.js";`);

s += `
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
    const perBot = \`\${defaultPath.slice(0, dot)}-\${CONFIG.BOT_ID}\${defaultPath.slice(dot)}\`;
    try {
        if (fsSync.existsSync(perBot)) return perBot;
    } catch { /* fayl tizimi xatosi — umumiy rasm ishlatiladi */ }
    return defaultPath;
}
`;
fs.writeFileSync("src/services/fileid.service.js", s);
console.log("OK fileid.service (brandImage)");

// ── Rasm yo'llarini brandImage orqali o'tkazamiz ──
const IMAGE_FILES = [
    ["src/handlers/start.handler.js", `"assets/images/start.png"`],
    ["src/handlers/help.handler.js", `"assets/images/info.png"`],
    ["src/handlers/filmlist.handler.js", `"assets/images/films.png"`],
    ["src/handlers/unknownCommand.handler.js", `"assets/images/error.png"`],
    ["src/middlewares/subscription.middleware.js", `"assets/images/icon2.png"`],
];

for (const [file, literal] of IMAGE_FILES) {
    let f = norm(file);
    if (!f.includes(literal)) { console.log(`XATO ${file}: ${literal} topilmadi`); process.exit(1); }

    // Konstanta sifatida e'lon qilingan fayllarda faqat e'lonni o'zgartiramiz
    const declMatch = f.match(new RegExp(`const (\\\\w+) = ${literal.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&")};`));
    if (declMatch) {
        f = f.replace(declMatch[0], `const ${declMatch[1]} = brandImage(${literal});`);
    } else {
        // To'g'ridan-to'g'ri ishlatilgan joylarni almashtiramiz
        f = f.split(`new InputFile(${literal})`).join(`new InputFile(brandImage(${literal}))`);
    }

    if (!f.includes("brandImage")) { console.log(`XATO ${file}: almashmadi`); process.exit(1); }

    // Import qo'shamiz
    if (!/import \{[^}]*brandImage/.test(f)) {
        f = f.replace(/import \{ (FileIdService) \} from "(.+fileid\.service\.js)";/,
            `import { $1, brandImage } from "$2";`);
    }
    if (!f.includes("brandImage }")) { console.log(`XATO ${file}: import qo'shilmadi`); process.exit(1); }

    fs.writeFileSync(file, f);
    console.log(`OK ${file}`);
}
