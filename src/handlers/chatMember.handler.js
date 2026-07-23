import { ApiService } from "../services/api.service.js";
import { SUBSCRIBED_STATUSES } from "../config/index.js";
import { pendingJoinRequests, subscriptionMessageIds } from "../store/memory.store.js";
import { KeyboardFactory } from "../keyboards/inline.menus.js";
import { clearUserSubCache } from "../middlewares/subscription.middleware.js";

export async function handleChatMember(ctx) {
    const status = ctx.chatMember.new_chat_member.status;
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    if (["member", "left", "kicked", "creator", "administrator"].includes(status)) {
        pendingJoinRequests.delete(`${chatId}_${userId}`);
        clearUserSubCache(userId);

        const isMember = ["member", "creator", "administrator"].includes(status);

        try {
            const channels = await ApiService.getRequiredChannels();
            const chatUsername = ctx.chat.username;

            const matchedChannel = channels.find(ch => {
                const tid = ch.telegram_id;
                return tid === String(chatId)
                    || tid === `@${chatUsername}`
                    || tid === chatUsername;
            });

            if (matchedChannel) {
                await ApiService.updateUser(userId, [{
                    telegram_id: matchedChannel.telegram_id,
                    is_member: isMember,
                    name: matchedChannel.name
                }], ctx.from.first_name, ctx.from.username);
            }
        } catch (e) {
            console.error("[ChatMember] Failed to push status to backend:", e.message);
        }
    }

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
            console.error("[ChatMember] Error checking:", e.message);
            checkedStatus[channel.telegram_id] = false;
        }
    }

    const keyboard = KeyboardFactory.createSubscriptionKeyboard(channels, checkedStatus);
    try {
        await ctx.api.editMessageReplyMarkup(userId, msgId, { reply_markup: keyboard });
    } catch (e) {
    }
}
