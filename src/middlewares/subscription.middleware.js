import { InputFile } from "grammy";
import { KeyboardFactory } from "../keyboards/inline.menus.js";
import { ApiService } from "../services/api.service.js";
import { SUBSCRIBED_STATUSES } from "../config/index.js";
import { pendingJoinRequests, subscriptionMessageIds } from "../store/memory.store.js";

let cachedWarningId = null;

const _userSubCache = new Map();
const USER_SUB_TTL = 60_000;

export function clearUserSubCache(userId) {
    _userSubCache.delete(userId);
}

export async function subscriptionMiddleware(ctx, next) {
    if (ctx.update.chat_join_request || ctx.update.chat_member) return next();

    if (ctx.chat && ctx.chat.type !== "private") return;

    if (!ctx.from) return next();

    const userId = ctx.from.id;
    const isCheckButton = ctx.callbackQuery?.data === "check_subscription";

    // Agar "Tekshirish" bosgan bo'lmasa VA kesh hali yangi bo'lsa — o'tkazib yuboramiz
    const userCache = _userSubCache.get(userId);
    if (!isCheckButton && userCache && Date.now() - userCache.checkedAt < USER_SUB_TTL) {
        if (!userCache.hasMissing) {
            return next(); // Obuna to'liq, shu 60s ichida qayta tekshirmaydi
        }
    }

    const channels = await ApiService.getRequiredChannels();

    const checkedStatus = {};
    let hasMissing = false;
    const missings = [];
    let isChanged = false;

    // Parallel tekshiruv (barcha kanallarni bir vaqtda tekshiradi)
    const results = await Promise.allSettled(
        channels.map(async (channel) => {
            if (pendingJoinRequests.has(`${channel.telegram_id}_${userId}`)) {
                return { channelId: channel.telegram_id, subscribed: true, name: channel.name };
            }
            const member = await ctx.api.getChatMember(channel.telegram_id, userId);
            const subscribed = SUBSCRIBED_STATUSES.includes(member.status);
            return { channelId: channel.telegram_id, subscribed, name: channel.name };
        })
    );

    for (const result of results) {
        if (result.status === "fulfilled") {
            const { channelId, subscribed, name } = result.value;
            checkedStatus[channelId] = subscribed;
            if (!subscribed) {
                hasMissing = true;
                missings.push(name);
            }
            if (ctx.session.subscription[channelId] !== subscribed) {
                isChanged = true;
            }
            ctx.session.subscription = { ...ctx.session.subscription, [channelId]: subscribed };
        } else {
            // Xatolik bo'lsa — channel'ni topamiz
            const channel = channels[results.indexOf(result)];
            console.error(`[Middleware] Kanal tekshirishda xato (${channel?.telegram_id}):`, result.reason?.message);
            checkedStatus[channel?.telegram_id] = false;
            hasMissing = true;
            missings.push(channel?.name);
        }
    }

    // Keshni yangilaymiz
    _userSubCache.set(userId, { status: checkedStatus, hasMissing, checkedAt: Date.now() });

    // Kesh hajmi oshib ketmasligi uchun tozalash
    if (_userSubCache.size > 10000) {
        const now = Date.now();
        for (const [key, val] of _userSubCache) {
            if (now - val.checkedAt > USER_SUB_TTL * 5) _userSubCache.delete(key);
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
            } else if (ctx.callbackQuery.data?.startsWith("already_subbed_")) {
                return next();
            } else {
                await ctx.answerCallbackQuery({ text: "⚠️ Avval kanalga a'zo bo'ling!", show_alert: true }).catch(() => { });
                await ctx.deleteMessage().catch(() => { });
                const msg = await sendPhotoWarning();
                subscriptionMessageIds.set(userId, msg.message_id);
            }
        } else {
            if (ctx.message) {
                options.reply_parameters = { message_id: ctx.message.message_id };
                if (ctx.message.text) {
                    ctx.session.pending_text = ctx.message.text;
                }
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
