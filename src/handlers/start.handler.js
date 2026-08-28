import { InputFile } from "grammy";
import { BRAND } from "../config/branding.js";
import { KeyboardFactory } from "../keyboards/inline.menus.js";
import { ApiService } from "../services/api.service.js";
import { FileIdService } from "../services/fileid.service.js";

const IMAGE_KEY = "start_photo";

async function replyWithCachedGif(ctx, caption, options) {
    const fullOptions = { caption, ...options };

    const cachedGifFileId = await FileIdService.get(IMAGE_KEY);
    if (cachedGifFileId) {
        return ctx.replyWithPhoto(cachedGifFileId, fullOptions);
    }

    const msg = await ctx.replyWithPhoto(new InputFile("assets/images/start.png"), fullOptions);

    // DIQQAT: photo[] eng KICHIKdan eng KATTAgacha tartiblangan.
    // photo[0] — 90px lik eskiz (~1 KB): uni keshlash keyingi barcha
    // foydalanuvchilarga xira rasm yuborilishiga olib kelardi.
    if (msg.photo?.length) {
        FileIdService.set(IMAGE_KEY, msg.photo[msg.photo.length - 1].file_id);
    }

    if (!ctx.session.is_registered) {
        ApiService.createUser({
            telegram_id: ctx.from.id,
            username: ctx.from.username,
            first_name: ctx.from.first_name,
        }).catch(error => console.error("[Start] createUser error:", error.message));
        ctx.session.is_registered = true;
    }

    return msg;
}

export async function handleStart(ctx) {
    ctx.session.step = "idle";
    const welcomeKeyboard = KeyboardFactory.createHomeMenu();

    const text = `<b>👋 Assalomu alaykum <a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a>, ${BRAND.name} botiga xush kelibsiz! \n\n📽️ Bu yerda siz:\n<blockquote>${BRAND.startLines}\n\n⭐ Imkoniyatidan foydalanishingiz mumkin.</blockquote>\n\n🍿 Maroqli tomosha tilaymiz! </b>`;

    const options = {
        parse_mode: "HTML",
        reply_markup: welcomeKeyboard,
    };

    if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery();
        try {
            if (ctx.callbackQuery.message.text) {
                if (ctx.callbackQuery.message.reply_to_message) {
                    options.reply_parameters = { 
                        message_id: ctx.callbackQuery.message.reply_to_message.message_id, 
                        allow_sending_without_reply: true 
                    };
                }
                await ctx.deleteMessage().catch(() => { });
                return replyWithCachedGif(ctx, text, options);
            } else {
                const cachedGifFileId = await FileIdService.get(IMAGE_KEY);
                const msg = await ctx.editMessageMedia(
                    {
                        type: "photo",
                        media: cachedGifFileId || new InputFile("assets/images/start.png"),
                        caption: text,
                        parse_mode: options.parse_mode
                    },
                    { reply_markup: options.reply_markup }
                );

                if (!cachedGifFileId && msg !== true && msg?.photo?.length) {
                    FileIdService.set(IMAGE_KEY, msg.photo[msg.photo.length - 1].file_id);
                }
            }
            return;
        } catch (error) {
            if (!error.message.includes("message is not modified") && !error.message.includes("media in the message")) {
                console.error("[Start] Edit message error:", error.message);
            }
            await ctx.deleteMessage().catch(() => { });
        }
    }

    if (ctx.message) {
        options.reply_parameters = { 
            message_id: ctx.message.message_id,
            allow_sending_without_reply: true 
        };
    }

    return replyWithCachedGif(ctx, text, options);
}