import { InlineKeyboard } from "grammy";

export const KeyboardFactory = {
    createSubscriptionKeyboard(channels, checkedStatus = {}) {
        const keyboard = new InlineKeyboard();

        channels.forEach((channel) => {
            const isSubbed = checkedStatus[channel.telegram_id] === true;
            const title = isSubbed ? "Tasdiqlandi" : channel.name;
            const statusIndicator = isSubbed ? "🟢" : "📢";
            const style = isSubbed ? "primary" : "";

            keyboard.url(`${statusIndicator} ${title} `, channel.invite_link).style(style).row();
        });

        keyboard.text("✅ Tekshirish", "check_subscription").style("success");
        return keyboard;
    },

    createHomeMenu() {
        return new InlineKeyboard()
            .text("📃 Bot haqida malumot", "btn_help").row()
            .text("🎬 Barcha filmlar", "btn_all_films")
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