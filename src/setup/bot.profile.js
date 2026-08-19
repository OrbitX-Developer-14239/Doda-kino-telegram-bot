import { InputFile } from "grammy";
import { BRAND, PROFILE_TEXTS, COMMANDS } from "../config/branding.js";

/**
 * Bot profili — nom/tavsif/buyruqlar BRENDGA QARAB o'rnatiladi.
 * Uchala bot bitta koddan ishlaydi, matnlar src/config/branding.js da.
 */
export async function setupBotProfile(bot) {
    try {
        // setMyProfilePhoto va setMyDescription'ni Telegram juda qattiq limitlaydi
        // (kuniga bir necha marta). Har restart'da chaqirilsa 429 beradi va
        // startup'ni sekinlashtiradi — shuning uchun faqat SETUP_PROFILE=1
        // bo'lganda (profil o'zgarganda bir marta) ishga tushiriladi.
        if (process.env.SETUP_PROFILE === "1") {
            // Uchala bot ham BITTA rasmni ishlatadi.
            // Diqqat: fayl nomi katta "I" bilan — Linux katta-kichikni farqlaydi.
            await bot.api.setMyProfilePhoto({
                type: "static",
                photo: new InputFile("assets/images/Icon.png"),
            });

            await bot.api.setMyDescription(PROFILE_TEXTS.descriptionUz, { language_code: "uz" });
            await bot.api.setMyDescription(PROFILE_TEXTS.descriptionRu, { language_code: "ru" });
            await bot.api.setMyDescription(PROFILE_TEXTS.descriptionEn);

            await bot.api.setMyShortDescription(PROFILE_TEXTS.shortUz, { language_code: "uz" });
            await bot.api.setMyShortDescription(PROFILE_TEXTS.shortRu, { language_code: "ru" });
            await bot.api.setMyShortDescription(PROFILE_TEXTS.shortEn);

            console.log(`[Bot] Profil (rasm/tavsiflar) yangilandi: ${BRAND.name} ✅`);
        }

        await bot.api.setMyCommands(COMMANDS);
        console.log(`[Bot] Buyruqlar yangilandi (${BRAND.name}) ✅`);
    } catch (err) {
        console.error("[Bot] Buyruqlarni o'rnatishda xatolik:", err.message);
    }
}
