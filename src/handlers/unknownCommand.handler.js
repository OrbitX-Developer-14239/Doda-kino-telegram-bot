import { InputFile } from "grammy";
import { KeyboardFactory } from "../keyboards/inline.menus.js";

let cachedImageFileId = null;
const DEFAULT_IMAGE_PATH = "assets/images/error.png";

async function replyWithCachedImage(ctx, caption, options) {
    const fullOptions = { caption, ...options };

    try {
        if (cachedImageFileId) {
            return await ctx.replyWithPhoto(cachedImageFileId, fullOptions);
        }

        const msg = await ctx.replyWithPhoto(new InputFile(DEFAULT_IMAGE_PATH), fullOptions);

        if (msg.photo?.length > 0) {
            cachedImageFileId = msg.photo[msg.photo.length - 1].file_id;
        }

        return msg;
    } catch (err) {
        if (err.message?.includes("message to be replied not found") && fullOptions.reply_parameters) {
            delete fullOptions.reply_parameters;
            if (cachedImageFileId) {
                return await ctx.replyWithPhoto(cachedImageFileId, fullOptions).catch(() => { });
            }
            return await ctx.replyWithPhoto(new InputFile(DEFAULT_IMAGE_PATH), fullOptions).catch(() => { });
        }
        throw err;
    }
}

export async function handleUnknownCommand(ctx) {
    const caption = 
        `❌ Noma'lum buyruq.\n` +
        `<blockquote><i>Siz kiritgan buyruq mavjud emas yoki noto'g'ri yozilgan.</i></blockquote>\n\n` +
        `<b><i>ℹ️ Mavjud buyruqlar va botdan foydalanish bo'yicha ma'lumot olish uchun /help buyrug'ini yuboring.</i></b>`;

    const options = {
        parse_mode: "HTML",
        reply_markup: KeyboardFactory.createBacktoHomeMenu(),
    };

    if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery().catch(() => {});
        try {
            if (ctx.callbackQuery.message.text) {
                await ctx.editMessageText(caption, options);
            } else {
                const updatedMsg = await ctx.editMessageMedia(
                    {
                        type: "photo",
                        media: cachedImageFileId || new InputFile(DEFAULT_IMAGE_PATH),
                        caption: caption,
                        parse_mode: options.parse_mode
                    },
                    { reply_markup: options.reply_markup }
                );

                if (!cachedImageFileId && updatedMsg.photo?.length > 0) {
                    cachedImageFileId = updatedMsg.photo[updatedMsg.photo.length - 1].file_id;
                }
            }
            return;
        } catch (error) {
            if (!error.message.includes("message is not modified")) {
                console.error("[UnknownCommand] Edit error:", error.message);
            }
            await ctx.deleteMessage().catch(() => {});
        }
    }

    if (ctx.message) {
        options.reply_parameters = { message_id: ctx.message.message_id };
    }

    return replyWithCachedImage(ctx, caption, options);
}