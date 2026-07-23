import { InputFile } from "grammy";
import { KeyboardFactory } from "../keyboards/inline.menus.js";
import { ApiService } from "../services/api.service.js";

let cachedGifFileId = null;

async function replyWithCachedGif(ctx, caption, options) {
    const fullOptions = { caption, ...options };

    if (cachedGifFileId) {
        return ctx.replyWithPhoto(cachedGifFileId, fullOptions);
    }

    const msg = await ctx.replyWithPhoto(new InputFile("assets/images/start.png"), fullOptions);

    if (msg.photo?.[0]?.file_id) {
        cachedGifFileId = msg.photo[0].file_id;
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

    const text = `<b>👋 Assalomu alaykum <a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a>, Asl Kino botiga xush kelibsiz! \n\n📽️ Bu yerda siz:\n<blockquote>• Eng yangi filmlar\n• Mashhur seriallar\n• Yuqori sifatli videolar\n• Qulay va tezkor qidiruv\n\n⭐ Imkoniyatidan foydalanishingiz mumkin.</blockquote>\n\n🍿 Maroqli tomosha tilaymiz! </b>`;

    const options = {
        parse_mode: "HTML",
        reply_markup: welcomeKeyboard,
    };

    if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery();
        try {
            if (ctx.callbackQuery.message.text) {
                if (ctx.callbackQuery.message.reply_to_message) {
                    options.reply_parameters = { message_id: ctx.callbackQuery.message.reply_to_message.message_id };
                }
                await ctx.deleteMessage().catch(() => { });
                return replyWithCachedGif(ctx, text, options);
            } else {
                const msg = await ctx.editMessageMedia(
                    {
                        type: "photo",
                        media: cachedGifFileId || new InputFile("assets/images/start.png"),
                        caption: text,
                        parse_mode: options.parse_mode
                    },
                    { reply_markup: options.reply_markup }
                );

                if (!cachedGifFileId && msg !== true && msg?.photo?.[0]?.file_id) {
                    cachedGifFileId = msg.photo[0].file_id;
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
        options.reply_parameters = { message_id: ctx.message.message_id };
    }

    return replyWithCachedGif(ctx, text, options);
}