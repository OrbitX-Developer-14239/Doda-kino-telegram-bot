import { InputFile } from "grammy";
import { KeyboardFactory } from "../keyboards/inline.menus.js";
import { ApiService } from "../services/api.service.js";
import { SUBSCRIBED_STATUSES } from "../config/index.js";
import { pendingJoinRequests, subscriptionMessageIds } from "../store/memory.store.js";

let cachedWarningId = null;

export async function subscriptionMiddleware(ctx, next) {
    if (ctx.update.chat_join_request || ctx.update.chat_member) return next();

    if (ctx.chat && ctx.chat.type !== "private") return;

    if (!ctx.from) return next();

    const userId = ctx.from.id;
    const channels = await ApiService.getRequiredChannels();

    const checkedStatus = {};
    let hasMissing = false;
    const missings = [];
    let isChanged = false;

    for (const channel of channels) {
        try {
            if (pendingJoinRequests.has(`${channel.telegram_id}_${userId}`)) {
                checkedStatus[channel.telegram_id] = true;
                continue;
            }

            const member = await ctx.api.getChatMember(channel.telegram_id, userId);

            if (SUBSCRIBED_STATUSES.includes(member.status)) {
                checkedStatus[channel.telegram_id] = true;
            } else {
                checkedStatus[channel.telegram_id] = false;
                hasMissing = true;
                missings.push(channel.name);
            }

            if (ctx.session.subscription[channel.telegram_id] !== checkedStatus[channel.telegram_id]) {
                isChanged = true;
            }

            ctx.session.subscription = { ...ctx.session.subscription, [channel.telegram_id]: checkedStatus[channel.telegram_id] };
        } catch (error) {
            console.error(`[Middleware] Kanal tekshirishda xato (${channel.telegram_id}):`, error.message);
            checkedStatus[channel.telegram_id] = false;
            hasMissing = true;
            missings.push(channel.name);
        }
    }

    if (isChanged) {
        const data = []
        for (const channel of channels) {
            data.push({
                telegram_id: channel.telegram_id,
                is_member: checkedStatus[channel.telegram_id],
                name: channel.name
            })
        }
        ApiService.updateUser(userId, data);
    }

    if (hasMissing) {
        const keyboard = KeyboardFactory.createSubscriptionKeyboard(channels, checkedStatus);
        const text = "<blockquote><b>⚠️ Botdan to'liq foydalanish uchun quyidagi kanalga a'zo bo'lishingiz shart!</b></blockquote>";

        const options = {
            caption: text,
            reply_markup: keyboard,
            parse_mode: "HTML",
        };

        const sendPhotoWarning = async () => {
            if (cachedWarningId) {
                return await ctx.replyWithPhoto(cachedWarningId, options);
            }
            const msg = await ctx.replyWithPhoto(new InputFile("assets/images/icon2.png"), options);
            if (msg.photo?.[0]?.file_id) {
                cachedWarningId = msg.photo[0].file_id;
            }
            return msg;
        };

        if (ctx.callbackQuery) {
            if (ctx.callbackQuery.data === "check_subscription") {
                try {
                    if (ctx.callbackQuery.message.text) {
                        // Agar oldin matn bo'lgan bo'lsa uni o'chirib, o'rniga rasm yuboramiz.
                        await ctx.deleteMessage().catch(() => { });
                        const msg = await sendPhotoWarning();
                        subscriptionMessageIds.set(userId, msg.message_id);
                    } else {
                        await ctx.editMessageMedia(
                            {
                                type: "photo",
                                media: cachedWarningId || new InputFile("assets/images/icon2.png"),
                                caption: text,
                                parse_mode: options.parse_mode
                            },
                            { reply_markup: options.reply_markup }
                        );
                        subscriptionMessageIds.set(userId, ctx.callbackQuery.message.message_id);
                    }
                } catch (error) {
                    if (!error.message.includes("message is not modified") && !error.message.includes("media in the message")) {
                        console.error("[Middleware] Edit message error:", error.message);
                    }
                }

                await ctx.answerCallbackQuery({
                    text: `${missings.join(", ")} kanaliga qo'shilmadingiz`,
                    show_alert: true,
                }).catch(() => { });
            } else {
                await ctx.answerCallbackQuery({ text: "⚠️ Avval kanalga a'zo bo'ling!", show_alert: true }).catch(() => { });
                await ctx.deleteMessage().catch(() => { });
                const msg = await sendPhotoWarning();
                subscriptionMessageIds.set(userId, msg.message_id);
            }
        } else {
            if (ctx.message) {
                options.reply_parameters = { message_id: ctx.message.message_id };
            }
            const msg = await sendPhotoWarning();
            subscriptionMessageIds.set(userId, msg.message_id);
        }
        return;
    }

    if (ctx.callbackQuery && ctx.callbackQuery.data === "check_subscription") {
        subscriptionMessageIds.delete(userId);
    }

    return next();
}
