import { InlineKeyboard } from "grammy";
import { BRAND } from "../config/branding.js";

export const KeyboardFactory = {
    createSubscriptionKeyboard(channels, checkedStatus = {}) {
        const keyboard = new InlineKeyboard();

        channels.forEach((channel) => {
            const isSubbed = checkedStatus[channel.telegram_id] === true;
            const title = isSubbed ? `${channel.name} tasdiqlandi` : `${channel.name} qo'shilish`;
            const statusIndicator = isSubbed ? "🟢" : "📢";
            const style = isSubbed ? "primary" : "";

            if (isSubbed) {
                keyboard.text(`${statusIndicator} ${title} `, `already_subbed_${channel.telegram_id}`).style(style).row();
            } else {
                keyboard.url(`${statusIndicator} ${title} `, channel.invite_link).row();
            }
        });

        keyboard.text("✅ Tekshirish", "check_subscription").style("success");
        return keyboard;
    },

    createHomeMenu() {
        return new InlineKeyboard()
            .text("📃 Bot haqida malumot", "btn_help").row()
            .text(`${BRAND.emoji} Barcha ${BRAND.plural}`, "btn_all_films")
            .text("🆔 Kod orqali qidrish", "btn_search_code").row()
            .text("🔍 Nom orqali qidirish", "btn_search_name");
    },

    createBacktoHomeMenu() {
        return new InlineKeyboard().text("🔙 Bosh sahifaga", "back_to_home").style("primary");
    },

    cancelSearch() {
        return new InlineKeyboard().text("❌ Bekor qilish", "cancel_search").style("danger");
    },

    backToSearch() {
        return new InlineKeyboard().text("🔙 Orqaga", "btn_search_name");
    },
};