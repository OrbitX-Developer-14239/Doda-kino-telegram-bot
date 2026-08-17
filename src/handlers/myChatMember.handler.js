import { ApiService } from "../services/api.service.js";

/**
 * BOTNING O'ZI biror kanal/guruhga qo'shilganda, admin qilinganda yoki
 * chiqarilganda Telegram `my_chat_member` hodisasini yuboradi.
 *
 * NEGA BU KERAK:
 * Telegram Bot API da "bot qaysi chatlarda bor" degan metod YO'Q.
 * Ro'yxatni faqat shu hodisalarni yozib borib tuzish mumkin. Backend uni
 * saqlaydi va admin panel "yangi kanal qo'shish" ro'yxatini shundan oladi.
 *
 * Diqqat: bu `chat_member` dan FARQ qiladi — u foydalanuvchilar haqida,
 * bu esa botning o'zi haqida.
 */
export async function handleMyChatMember(ctx) {
    const update = ctx.myChatMember;
    if (!update) return;

    const chat = update.chat;
    const member = update.new_chat_member;

    // Shaxsiy suhbatlar ro'yxatga kirmaydi — faqat kanal va guruhlar
    if (!chat || chat.type === "private") return;

    const status = member?.status || "member";

    try {
        await ApiService.syncDiscoveredChat({
            telegram_id: String(chat.id),
            title: chat.title || "",
            username: chat.username || null,
            type: chat.type,
            bot_status: status,
            // creator har doim taklif qila oladi, administrator uchun alohida huquq
            can_invite_users: status === "creator" || member?.can_invite_users === true,
        });

        const label = ["administrator", "creator"].includes(status) ? "ADMIN" : status;
        console.log(`[MyChatMember] ${chat.title || chat.id} (${chat.id}) -> ${label}`);
    } catch (error) {
        console.error("[MyChatMember] backendga yozib bo'lmadi:", error.message);
    }
}
