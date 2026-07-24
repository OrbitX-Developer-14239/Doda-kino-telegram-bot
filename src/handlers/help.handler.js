import { InputFile } from "grammy";
import { KeyboardFactory } from "../keyboards/inline.menus.js";

let cachedImageFileId = null;
const DEFAULT_IMAGE_PATH = "assets/images/info.png";

async function replyWithCachedImage(ctx, caption, options) {
    const fullOptions = { caption, ...options };

    if (cachedImageFileId) {
        return ctx.replyWithPhoto(cachedImageFileId, fullOptions);
    }

    const msg = await ctx.replyWithPhoto(new InputFile(DEFAULT_IMAGE_PATH), fullOptions);

    if (msg.photo?.length > 0) {
        cachedImageFileId = msg.photo[msg.photo.length - 1].file_id;
    }

    return msg;
}

export async function handleHelp(ctx) {
    ctx.session.step = "idle";
    
    const helpText =
        `📃 <b>Bot haqida:</b>\n` +
        `<blockquote><i>📽️ <b>Doda kino — </b> filmlarni tez, qulay va oson topish uchun yaratilgan Telegram boti. Bot orqali film nomi, maxsus kodi yoki sun'iy intellekt (AI) qidiruvi yordamida kerakli filmni topishingiz mumkin.\n\n` +
        `🤖 Bot muntazam ravishda yangilanib boriladi va foydalanuvchilarga sifatli hamda qulay xizmat ko'rsatishni maqsad qiladi. Oddiy va tushunarli interfeys tufayli kerakli filmni bir necha soniya ichida topishingiz mumkin.\n\n` +
        `⭐ Doda kino bilan sevimli filmlaringizni izlash yanada oson va qulay!</i></blockquote>\n\n` +
        `⚙️ <b>Bot buyruqlari:</b>\n` +
        `<blockquote><b>/start — </b> <i>Botni qayta ishga tushirish</i>\n` +
        `<b>/help — </b> <i>Bot bo'yicha to'liq qo'llanma</i>\n` +
        `<b>/search — </b> <i>Sun'iy intellekt orqali matnli qidiruv</i>\n` +
        `<b>/code — </b> <i>Raqamli kod orqali qidiruv</i>\n` +
        `<b>/films — </b> <i>Botdagi barcha filmlar ro'yxati</i></blockquote>`;

    const keyboard = KeyboardFactory.createBacktoHomeMenu();

    const options = {
        parse_mode: "HTML",
        reply_markup: keyboard,
    };

    if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery().catch(() => {});
        
        try {
            if (ctx.callbackQuery.message.text) {
                await ctx.editMessageText(helpText, options);
            } 
            else {
                const updatedMsg = await ctx.editMessageMedia(
                    {
                        type: "photo",
                        media: cachedImageFileId || new InputFile(DEFAULT_IMAGE_PATH),
                        caption: helpText,
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
            const isIgnorableError = error.message.includes("message is not modified") || 
                                     error.message.includes("media in the message");
            
            if (!isIgnorableError) {
                console.error("[Help] Edit message error:", error.message);
            }
            
            await ctx.deleteMessage().catch(() => {});
        }
    }
    if (ctx.message) {
        options.reply_parameters = { message_id: ctx.message.message_id };
    }

    return replyWithCachedImage(ctx, helpText, options);
}