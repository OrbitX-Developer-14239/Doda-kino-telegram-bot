import { InputFile } from "grammy";
import { KeyboardFactory } from "../keyboards/inline.menus.js";
import { ApiService } from "../services/api.service.js";
import { SUBSCRIBED_STATUSES, isPrivateBypassUser } from "../config/index.js";
import { pendingJoinRequests, subscriptionMessageIds } from "../store/memory.store.js";
import { FileIdService } from "../services/fileid.service.js";

const WARNING_IMAGE_KEY = "sub_warning_photo";

// User kanaldan chiqsa chat_member event keladi va kesh DARHOL tozalanadi
// (clearUserSubCache) — shuning uchun OK muddatini uzun qilish xavfsiz.
const _userSubCache = new Map();
const USER_SUB_TTL_OK = 1_800_000;   // 30 daqiqa — obunasi to'liq
const USER_SUB_TTL_MISSING = 15_000; // 15 soniya — obunasi to'liq emas

// Panelda kanal ro'yxati o'zgarganini shu raqam bildiradi.
// null — hali bir marta ham o'qilmagan (bot endi ishga tushgan).
let _channelsVersion = null;

/**
 * Kanal ro'yxati o'zgargan bo'lsa BARCHA keshlarni tashlaydi.
 *
 * NEGA SHART: "obunasi to'liq" deb belgilangan foydalanuvchi 30 daqiqa
 * davomida umuman tekshirilmaydi. Usiz admin yangi majburiy kanal
 * qo'shsa, u faqat yarim soatdan keyin so'ralardi.
 */
async function syncChannelsVersion() {
    const version = await ApiService.getChannelsVersion();

    if (_channelsVersion === null) {
        _channelsVersion = version;   // birinchi o'qish — tozalash shart emas
        return;
    }

    if (version !== _channelsVersion) {
        _channelsVersion = version;
        _userSubCache.clear();
        ApiService.clearChannelsCache();
        console.log("[Obuna] Kanallar ro'yxati o'zgardi — keshlar tozalandi");
    }
}

export function clearUserSubCache(userId) {
    _userSubCache.delete(userId);
}

function computeMissingNames(channels, checkedStatus, userId) {
    const missings = [];
    for (const channel of channels) {
        if (isPrivateBypassUser(channel, userId)) continue;
        if (!checkedStatus[channel.telegram_id]) {
            missings.push(channel.name);
        }
    }
    return missings;
}

async function showSubscriptionWarning(ctx, channels, checkedStatus, missings) {
    const userId = ctx.from.id;
    const visibleChannels = channels.filter(ch => !isPrivateBypassUser(ch, userId));
    const keyboard = KeyboardFactory.createSubscriptionKeyboard(visibleChannels, checkedStatus);
    const text = "<blockquote><b>⚠️ Botdan to'liq foydalanish uchun quyidagi kanalga a'zo bo'lishingiz shart!</b></blockquote>";

    const options = {
        caption: text,
        reply_markup: keyboard,
        parse_mode: "HTML",
    };

    const cachedWarningId = await FileIdService.get(WARNING_IMAGE_KEY);

    const sendPhotoWarning = async () => {
        if (cachedWarningId) {
            return await ctx.replyWithPhoto(cachedWarningId, options);
        }
        const msg = await ctx.replyWithPhoto(new InputFile("assets/images/icon2.png"), options);
        if (msg.photo?.[0]?.file_id) {
            FileIdService.set(WARNING_IMAGE_KEY, msg.photo[0].file_id);
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
}

export async function subscriptionMiddleware(ctx, next) {
    // Xizmat yangilanishlari obuna tekshiruvidan o'tkazilmaydi.
    // my_chat_member ham shu yerda: u kanaldan keladi, quyidagi "private emas"
    // sharti uni next() siz to'xtatib qo'yardi — natijada handler ishlamasdi.
    if (ctx.update.chat_join_request || ctx.update.chat_member || ctx.update.my_chat_member) {
        return next();
    }

    if (ctx.chat && ctx.chat.type !== "private") return;

    if (!ctx.from) return next();

    const userId = ctx.from.id;
    const isCheckButton = ctx.callbackQuery?.data === "check_subscription";

    // Redis'dan bitta yengil o'qish (~1 ms): panelda kanal o'zgargan bo'lsa
    // keshlar shu yerda tashlanadi va o'zgarish DARHOL kuchga kiradi.
    await syncChannelsVersion().catch(() => { });

    if (ctx.callbackQuery?.data?.startsWith("already_subbed_")) {
        return next();
    }

    // Kesh tekshirish — "Tekshirish" tugmasi bosilmagan va kesh yangi bo'lsa,
    // Telegram API'ga umuman murojaat qilmaymiz.
    const userCache = _userSubCache.get(userId);
    if (!isCheckButton && userCache) {
        const ttl = userCache.hasMissing ? USER_SUB_TTL_MISSING : USER_SUB_TTL_OK;
        if (Date.now() - userCache.checkedAt < ttl) {
            if (!userCache.hasMissing) {
                return next();
            }

            // Obunasi to'liq emasligi keshdan ma'lum — qayta tekshirmasdan
            // (getChatMember'siz) bloklab, ogohlantirishni ko'rsatamiz.
            const channels = await ApiService.getRequiredChannels();
            if (!channels || channels.length === 0) {
                _userSubCache.set(userId, { status: {}, hasMissing: false, checkedAt: Date.now() });
                return next();
            }
            const missings = computeMissingNames(channels, userCache.status, userId);
            await showSubscriptionWarning(ctx, channels, userCache.status, missings);
            return;
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
            if (isPrivateBypassUser(channel, userId)) {
                return { channelId: channel.telegram_id, subscribed: true, name: channel.name };
            }
            if (pendingJoinRequests.has(`${channel.telegram_id}_${userId}`)) {
                return { channelId: channel.telegram_id, subscribed: true, name: channel.name };
            }
            const member = await ctx.api.getChatMember(channel.telegram_id, userId);
            const subscribed = SUBSCRIBED_STATUSES.includes(member.status);
            return { channelId: channel.telegram_id, subscribed, name: channel.name };
        })
    );

    for (let i = 0; i < results.length; i++) {
        const result = results[i];
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
            const channel = channels[i];
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
        await showSubscriptionWarning(ctx, channels, checkedStatus, missings);
        return;
    }

    if (isCheckButton) {
        subscriptionMessageIds.delete(userId);
    }

    return next();
}
