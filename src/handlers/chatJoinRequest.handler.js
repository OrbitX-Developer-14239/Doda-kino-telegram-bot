import { pendingJoinRequests, subscriptionMessageIds } from "../store/memory.store.js";
import { ApiService } from "../services/api.service.js";
import { KeyboardFactory } from "../keyboards/inline.menus.js";
import { SUBSCRIBED_STATUSES, isPrivateBypassUser } from "../config/index.js";

export async function handleChatJoinRequest(ctx) {
    try {
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
