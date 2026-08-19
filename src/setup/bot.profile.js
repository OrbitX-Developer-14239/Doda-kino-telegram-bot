import fs from "fs";
import { InputFile } from "grammy";
import { CONFIG } from "../config/index.js";
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
            // Har botning o'z ikonkasi: assets/images/icon-<BOT_ID>.png
            // bo'lsa o'sha, bo'lmasa umumiy icon.png ishlatiladi.
            const perBotIcon = `assets/images/icon-${CONFIG.BOT_ID}.png`;
            const iconPath = fs.existsSync(perBotIcon) ? perBotIcon : "assets/images/icon.png";

            await bot.api.setMyProfilePhoto({
                type: "static",
                photo: new InputFile(iconPath),
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
