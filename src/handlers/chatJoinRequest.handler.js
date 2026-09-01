import { InlineKeyboard } from "grammy";
import { pendingJoinRequests, subscriptionMessageIds } from "../store/memory.store.js";
import { ApiService } from "../services/api.service.js";
import { KeyboardFactory } from "../keyboards/inline.menus.js";
import { SUBSCRIBED_STATUSES, isPrivateBypassUser, CONFIG } from "../config/index.js";
import { BRAND } from "../config/branding.js";

/**
 * ============================================
 *  SINOV: zayavka tashlaganga xabar yozish
 * ============================================
 *
 * Telegram qoidasi: bot suhbatni boshlay olmaydi. YAGONA istisno —
 * odam kanalga ZAYAVKA tashlaganda: shunda `user_chat_id` beriladi va
 * bot unga 5 DAQIQA ichida yozishi mumkin (so'rov ko'rib chiqilgunicha).
 *
 * DIQQAT — tartib muhim: avval XABAR, keyin tasdiqlash. Tasdiqlash
 * oynani YOPADI, shuning uchun teskari qilinsa hech kimga xabar bormaydi.
 * Bu sinovda tasdiqlash umuman qilinmaydi (zayavka osilib turadi).
 *
 * Tugma ATAYLAB deep-link: uni bosgan odam botga /start yuboradi va
 * DOIMIY foydalanuvchiga aylanadi. Inline tugma bunday kafolat bermaydi —
 * 5 daqiqa tugagach bot yana yoza olmay qoladi.
 *
 * Faqat JOIN_TEST_CHANNEL_ID kanalida ishlaydi.
 */
async function handleJoinTest(ctx) {
    const req = ctx.chatJoinRequest;
    const userChatId = req.user_chat_id;
    if (!userChatId) {
        console.warn("[Zayavka] user_chat_id yo'q — xabar yuborib bo'lmaydi");
        return;
    }

    const me = ctx.me?.username || "";
    const keyboard = new InlineKeyboard().url(
        `${BRAND.emoji} Botni ochish`,
        `https://t.me/${me}?start=zayavka`
    );

    const text =
        `<b>Assalomu alaykum, ${req.from.first_name || ""}!</b>\n\n` +
        `<blockquote>So'rovingiz qabul qilindi. ${BRAND.name} botida ` +
        `minglab ${BRAND.plural} sizni kutmoqda.</blockquote>\n\n` +
        `<b>Boshlash uchun pastdagi tugmani bosing 👇</b>`;

    try {
        await ctx.api.sendMessage(userChatId, text, {
            parse_mode: "HTML",
            reply_markup: keyboard,
        });
        console.log(`[Zayavka] ✅ ${req.from.id} (${req.from.first_name}) ga xabar yuborildi`);
    } catch (error) {
        console.error(`[Zayavka] ❌ ${req.from.id}: ${error.description || error.message}`);
    }
}

export async function handleChatJoinRequest(ctx) {
    try {
        // Sinov kanali: xabar yoziladi, zayavka TASDIQLANMAYDI
        if (CONFIG.JOIN_TEST_CHANNEL_ID &&
            String(ctx.chat.id) === String(CONFIG.JOIN_TEST_CHANNEL_ID)) {
            return handleJoinTest(ctx);
        }

        const userId = ctx.from.id;
        pendingJoinRequests.add(`${ctx.chat.id}_${userId}`);

        const msgId = subscriptionMessageIds.get(userId);
        if (!msgId) return;

        const channels = await ApiService.getRequiredChannels();
        const checkedStatus = {};

        for (const channel of channels) {
            if (pendingJoinRequests.has(`${channel.telegram_id}_${userId}`)) {
                checkedStatus[channel.telegram_id] = true;
                continue;
            }
            try {
                const member = await ctx.api.getChatMember(channel.telegram_id, userId);
                checkedStatus[channel.telegram_id] = SUBSCRIBED_STATUSES.includes(member.status);
            } catch (e) {
                checkedStatus[channel.telegram_id] = false;
            }
        }

        const visibleChannels = channels.filter(ch => !isPrivateBypassUser(ch, userId));
        const keyboard = KeyboardFactory.createSubscriptionKeyboard(visibleChannels, checkedStatus);
        
        try {
            await ctx.api.editMessageReplyMarkup(userId, msgId, { reply_markup: keyboard });
        } catch (e) {
            // Ignore message not modified errors
        }
    } catch (error) {
        console.error("Chat join request xatosi:", error.message);
    }
}
