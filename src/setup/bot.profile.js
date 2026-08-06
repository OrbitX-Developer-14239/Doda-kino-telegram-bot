import { InputFile } from "grammy";

export async function setupBotProfile(bot) {
    try {
        // setMyProfilePhoto va setMyDescription'ni Telegram juda qattiq limitlaydi
        // (kuniga bir necha marta). Har restart'da chaqirilsa 429 beradi va
        // startup'ni sekinlashtiradi — shuning uchun faqat SETUP_PROFILE=1
        // bo'lganda (profil o'zgarganda bir marta) ishga tushiriladi.
        if (process.env.SETUP_PROFILE === "1") {
            await bot.api.setMyProfilePhoto({
                type: "static",
                photo: new InputFile("assets/images/icon.png"),
            });

            await bot.api.setMyDescription(
                "👋 Salom! \"Doda Kino\" botiga xush kelibsiz!\n\n" +
                "Bu yerda siz quyidagilarni amalga oshirishingiz mumkin:\n" +
                "🔥 Eng so'nggi va mashhur kinolarni topish;\n" +
                "🎞 Filmlarni yuqori sifatda tomosha qilish va yuklab olish;\n" +
                "🔎 O'zingiz yoqtirgan janrdagi kinolarni oson qidirish.\n\n" +
                "🍿 Popkornni tayyorlang va kinolar olamiga sayohatni boshlash uchun pastdagi START tugmasini bosing!",
                { language_code: "uz" }
            );

            await bot.api.setMyDescription(
                "👋 Привет! Добро пожаловать в бота \"Doda Kino\"!\n\n" +
                "Здесь вы можете:\n" +
                "🔥 Найти самые новые и популярные фильмы;\n" +
                "🎞 Смотреть и скачивать кино в высоком качестве;\n" +
                "🔎 Легко искать фильмы по вашим любимым жанрам.\n\n" +
                "🍿 Готовьте попкорн и нажимайте кнопку START ниже, чтобы начать просмотр!",
                { language_code: "ru" }
            );

            await bot.api.setMyDescription(
                "👋 Hello! Welcome to the \"Doda Kino\" bot!\n\n" +
                "Here you can:\n" +
                "🔥 Find the latest and most popular movies;\n" +
                "🎞 Watch and download films in high quality;\n" +
                "🔎 Easily search for movies in your favorite genres.\n\n" +
                "🍿 Grab your popcorn and press the START button below to begin your movie journey!"
            );

            await bot.api.setMyShortDescription(
                "🎬 \"Doda Kino\" - eng sifatli va yangi filmlarni tezkor topish uchun qulay bot. Kino olamiga xush kelibsiz! 🍿",
                { language_code: "uz" }
            );

            await bot.api.setMyShortDescription(
                "🎬 \"Doda Kino\" — удобный бот для поиска новых фильмов в лучшем качестве. Добро пожаловать в мир кино! 🍿",
                { language_code: "ru" }
            );

            await bot.api.setMyShortDescription(
                "🎬 \"Doda Kino\" - a convenient bot to find the latest and top-quality movies. Welcome to the world of cinema! 🍿"
            );

            console.log("[Bot] Profil (rasm/tavsiflar) yangilandi ✅");
        }

        await bot.api.setMyCommands([
            { command: "start", description: "Botni ishga tushirish." },
            { command: "search", description: "Filmni nomi bo'yicha qidirish." },
            { command: "code", description: "Film kodi orqali qidirish." },
            { command: "films", description: "Barcha filmlar ro'yxatini ko'rish." },
            { command: "help", description: "Foydalanish bo'yicha ma'lumot." },
        ]);
        console.log("[Bot] Buyruqlar yangilandi ✅");
    } catch (err) {
        console.error("[Bot] Buyruqlarni o'rnatishda xatolik:", err.message);
    }
}
