import { InputFile } from "grammy";
import { KeyboardFactory } from "../keyboards/inline.menus.js";
import { ApiService } from "../services/api.service.js";
import { SUBSCRIBED_STATUSES } from "../config/index.js";
import { pendingJoinRequests, subscriptionMessageIds } from "../store/memory.store.js";

let cachedWarningId = null;

// Obuna to'liq bo'lgan userlar uchun 5 daqiqa, bo'lmaganlar uchun 15 soniya
const _userSubCache = new Map();
const USER_SUB_TTL_OK = 300_000;    // 5 daqiqa — obunasi to'liq
const USER_SUB_TTL_MISSING = 15_000; // 15 soniya — obunasi to'liq emas

export function clearUserSubCache(userId) {
    _userSubCache.delete(userId);
}

export async function subscriptionMiddleware(ctx, next) {
    if (ctx.update.chat_join_request || ctx.update.chat_member) return next();

    if (ctx.chat && ctx.chat.type !== "private") return;

    if (!ctx.from) return next();

    const userId = ctx.from.id;
    const isCheckButton = ctx.callbackQuery?.data === "check_subscription";

    // Kesh tekshirish — "Tekshirish" tugmasini bosmagan va kesh yangi bo'lsa, o'tkazish
    const userCache = _userSubCache.get(userId);
    if (!isCheckButton && userCache) {
        const ttl = userCache.hasMissing ? USER_SUB_TTL_MISSING : USER_SUB_TTL_OK;
        if (Date.now() - userCache.checkedAt < ttl) {
            if (!userCache.hasMissing) {
                return next();
            }
        }
    }

    const channels = await ApiService.getRequiredChannels();

    // Kanallar bo'sh bo'lsa — to'g'ridan-to'g'ri o'tkazish
    if (!channels || channels.length === 0) {
        _userSubCache.set(userId, { status: {}, hasMissing: false, checkedAt: Date.now() });
        return next();
    }

    const checkedStatus = {};
    let hasMissing = false;
    const missings = [];
    let isChanged = false;

    // Parallel tekshiruv (barcha kanallarni BIR VAQTDA tekshiradi)
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
            if (now - val.checkedAt > USER_SUB_TTL_OK * 2) _userSubCache.delete(key);
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
        // Fire-and-forget — kutmasdan jo'natamiz
        ApiService.updateUser(userId, data, ctx.from.first_name, ctx.from.username);
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
