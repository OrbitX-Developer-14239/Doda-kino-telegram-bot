import { CONFIG } from "./index.js";

/**
 * ============================================
 *  Bot brendingi — BITTA KOD, HAR XIL BOT
 * ============================================
 *
 * Uchala bot ham AYNAN SHU koddan ishlaydi (3 ta nusxa repo YO'Q).
 * Qaysi bot ekani .env dagi BOT_TOKEN dan aniqlanadi (BOT_ID) va shu
 * yerdan unga mos nom, so'zlar va profil matnlari tanlanadi.
 *
 * Yangi bot qo'shilsa: pastdagi BRANDS ga bitta yozuv qo'shiladi, tamom.
 * Hech qaysi handler o'zgarmaydi — ular BRAND dan o'qiydi.
 *
 * So'z birikish qoidasi (o'zbekcha qo'shimchalar):
 *   `${BRAND.item}ni`      -> filmni / multfilmni / animeni
 *   `${BRAND.plural}ni`    -> filmlarni / multfilmlarni / animelarni
 *   `${BRAND.plural}ingiz` -> filmlaringiz / multfilmlaringiz / animelaringiz
 */

const BRANDS = {
    // ── 1-bot: @doda_kino_bot ──
    "8887969510": {
        name: "Doda Kino",
        emoji: "🎬",
        item: "film",          // "film topilmadi"
        Item: "Film",          // "Film kodi"
        plural: "filmlar",     // "filmlar ro'yxati"
        // Ro'yxat buyrug'i — inglizcha: /films, /cartoons, /animes
        listCommand: "films",
        // /start dagi imkoniyatlar ro'yxati
        startLines: "• Eng yangi filmlar\n• Mashhur seriallar\n• Yuqori sifatli videolar\n• Qulay va tezkor qidiruv",
        // Qidiruv misollari — har botda o'ziga mos
        searchExamples: `• "Titanic"\n• "Bir bola sehrgarlar maktabiga boradi."\n• "Kosmosda omon qolish haqida film."\n• "Bosh qahramoni John Wick."`,
        // Telegram profil matnlari uchun so'zlar
        uz: "kinolarni", ru: "фильмы", en: "movies",
        worldUz: "kinolar olamiga", worldRu: "в мир кино", worldEn: "the world of cinema",
    },

    // ── 4-bot: @mega_filmlar_bot ──
    // FILMLARI 1-bot bilan UMUMIY (bitta baza), faqat nomi, matnlari va
    // rasmlari boshqa. Shuning uchun so'zlari ham "film" bo'lib qoladi.
    "8829216136": {
        name: "Mega Filmlar",
        emoji: "🎞",
        // Rasmlar shu papkadan olinadi (assets/images/mega-filmlar/).
        // Papkada bo'lmagan rasm uchun umumiysi ishlatiladi.
        imageDir: "mega-filmlar",
        item: "film",
        Item: "Film",
        plural: "filmlar",
        listCommand: "films",
        startLines: "• Yangi va mashhur filmlar\n• Seriallar to'liq to'plami\n• Yuqori sifatli videolar\n• Sun'iy intellektli qidiruv",
        searchExamples: `• "Interstellar"\n• "Kemasi cho'kib ketadigan sevgi filmi."\n• "Sehrgarlar maktabidagi bola."\n• "Bosh qahramoni John Wick."`,
        uz: "kinolarni", ru: "фильмы", en: "movies",
        worldUz: "kinolar olamiga", worldRu: "в мир кино", worldEn: "the world of cinema",

        // O'Z profil matni — umumiy shablondan emas. Doda Kino bilan
        // bir xil filmlarni ko'rsatsa ham, tavsifi ataylab boshqacha.
        profile: {
            uz:
                "🎞 Mega Filmlar — kinoning nomini bilmasangiz ham topib beradigan bot.\n\n" +
                "Nima qila olasiz:\n" +
                "🔎 Esingizda qolgan sahnani yoki qahramonni tasvirlab yozing — sun'iy intellekt kinoni o'zi aniqlaydi;\n" +
                "🆔 Kodni bilsangiz bir soniyada oching;\n" +
                "📚 Seriallarni fasllari bo'yicha tartib bilan ko'ring;\n" +
                "📥 Yuqori sifatda yuklab oling.\n\n" +
                "Boshlash uchun pastdagi START tugmasini bosing!",
            ru:
                "🎞 Mega Filmlar — бот, который найдёт фильм даже без названия.\n\n" +
                "Что умеет:\n" +
                "🔎 Опишите сцену или героя — искусственный интеллект сам определит фильм;\n" +
                "🆔 Открывайте фильмы по коду за секунду;\n" +
                "📚 Смотрите сериалы по сезонам, по порядку;\n" +
                "📥 Скачивайте в высоком качестве.\n\n" +
                "Нажмите START, чтобы начать!",
            en:
                "🎞 Mega Filmlar — the bot that finds a film even without its title.\n\n" +
                "What it does:\n" +
                "🔎 Describe a scene or a character — the AI works out which film you mean;\n" +
                "🆔 Open any film by its code in a second;\n" +
                "📚 Watch series season by season, in order;\n" +
                "📥 Download in high quality.\n\n" +
                "Press START to begin!",
            shortUz: "🎞 Nomini bilmasangiz ham kinoni topib beradi. Sahnani tasvirlab yozing — qolganini AI qiladi.",
            shortRu: "🎞 Найдёт фильм по описанию сцены. Не помните название — просто расскажите сюжет.",
            shortEn: "🎞 Finds any film from a description. Forgot the title? Just tell the plot.",
        },
    },

    // ── 2-bot: @doda_multik_bot ──
    "8288956451": {
        name: "Doda Multik",
        emoji: "🧸",
        item: "multfilm",
        Item: "Multfilm",
        plural: "multfilmlar",
        listCommand: "cartoons",
        startLines: "• Eng yangi multfilmlar\n• Mashhur multseriallar\n• Yuqori sifatli videolar\n• Qulay va tezkor qidiruv",
        searchExamples: `• "Muzlik davri"\n• "O'yinchoqlar jonlanib qoladigan multfilm."\n• "Yashil dev va gapiradigan eshak sarguzashtlari."\n• "Sehrli muzlatadigan malika haqida."`,
        uz: "multfilmlarni", ru: "мультфильмы", en: "cartoons",
        worldUz: "multfilmlar olamiga", worldRu: "в мир мультфильмов", worldEn: "the world of cartoons",
    },

    // ── 3-bot: @doda_anime_bot ──
    "8873652399": {
        name: "Doda Anime",
        emoji: "🌸",
        item: "anime",
        Item: "Anime",
        plural: "animelar",
        listCommand: "animes",
        startLines: "• Eng yangi animelar\n• Mashhur anime seriallar\n• Yuqori sifatli videolar\n• Qulay va tezkor qidiruv",
        searchExamples: `• "Naruto"\n• "Bola titanga aylanadigan anime."\n• "O'lim daftarini topib olgan yigit."\n• "Bosh qahramoni pirat qiroli bo'lishni orzu qiladi."`,
        uz: "animelarni", ru: "аниме", en: "anime",
        worldUz: "anime olamiga", worldRu: "в мир аниме", worldEn: "the world of anime",
    },
};

export const BRAND = BRANDS[CONFIG.BOT_ID] || BRANDS["8887969510"];

if (!BRANDS[CONFIG.BOT_ID]) {
    console.warn(
        `[Branding] BOT_ID=${CONFIG.BOT_ID} uchun brend topilmadi — "Doda Kino" ishlatiladi. ` +
        `Yangi bot bo'lsa src/config/branding.js ga yozuv qo'shing.`
    );
}

/** Telegram profil tavsiflari (setMyDescription) — 3 tilda */
// Brendda `profile` bo'lsa — o'sha matn, bo'lmasa umumiy shablon.
// Shu tufayli har bot mutlaqo boshqa tavsifga ega bo'la oladi.
const P = BRAND.profile || {};

export const PROFILE_TEXTS = {
    descriptionUz: P.uz ||
        `👋 Salom! "${BRAND.name}" botiga xush kelibsiz!\n\n` +
        `Bu yerda siz quyidagilarni amalga oshirishingiz mumkin:\n` +
        `🔥 Eng so'nggi va mashhur ${BRAND.uz} topish;\n` +
        `🎞 ${BRAND.Item}larni yuqori sifatda tomosha qilish va yuklab olish;\n` +
        `🔎 O'zingiz yoqtirgan janrdagi ${BRAND.uz} oson qidirish.\n\n` +
        `🍿 Popkornni tayyorlang va ${BRAND.worldUz} sayohatni boshlash uchun pastdagi START tugmasini bosing!`,

    descriptionRu: P.ru ||
        `👋 Привет! Добро пожаловать в бота "${BRAND.name}"!\n\n` +
        `Здесь вы можете:\n` +
        `🔥 Найти самые новые и популярные ${BRAND.ru};\n` +
        `🎞 Смотреть и скачивать ${BRAND.ru} в высоком качестве;\n` +
        `🔎 Легко искать ${BRAND.ru} по вашим любимым жанрам.\n\n` +
        `🍿 Готовьте попкорн и нажимайте кнопку START ниже, чтобы отправиться ${BRAND.worldRu}!`,

    descriptionEn: P.en ||
        `👋 Hello! Welcome to the "${BRAND.name}" bot!\n\n` +
        `Here you can:\n` +
        `🔥 Find the latest and most popular ${BRAND.en};\n` +
        `🎞 Watch and download ${BRAND.en} in high quality;\n` +
        `🔎 Easily search for ${BRAND.en} in your favorite genres.\n\n` +
        `🍿 Grab your popcorn and press the START button below to enter ${BRAND.worldEn}!`,

    shortUz: P.shortUz || `${BRAND.emoji} "${BRAND.name}" - eng sifatli va yangi ${BRAND.uz} tezkor topish uchun qulay bot. ${BRAND.worldUz.charAt(0).toUpperCase() + BRAND.worldUz.slice(1)} xush kelibsiz! 🍿`,
    shortRu: P.shortRu || `${BRAND.emoji} "${BRAND.name}" — удобный бот для поиска новых ${BRAND.ru} в лучшем качестве. Добро пожаловать ${BRAND.worldRu}! 🍿`,
    shortEn: P.shortEn || `${BRAND.emoji} "${BRAND.name}" - a convenient bot to find the latest and top-quality ${BRAND.en}. Welcome to ${BRAND.worldEn}! 🍿`,
};

/** Bot buyruqlari tavsiflari (setMyCommands) */
export const COMMANDS = [
    { command: "start", description: "Botni ishga tushirish." },
    { command: "search", description: `${BRAND.Item}ni nomi bo'yicha qidirish.` },
    { command: "code", description: `${BRAND.Item} kodi orqali qidirish.` },
    { command: BRAND.listCommand, description: `Barcha ${BRAND.plural} ro'yxatini ko'rish.` },
    { command: "help", description: "Foydalanish bo'yicha ma'lumot." },
];
