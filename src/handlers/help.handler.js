import { InputFile } from "grammy";
import { BRAND } from "../config/branding.js";
import { KeyboardFactory } from "../keyboards/inline.menus.js";
import { FileIdService, brandImage } from "../services/fileid.service.js";

const IMAGE_KEY = "help_photo";
const DEFAULT_IMAGE_PATH = brandImage("assets/images/info.png");

async function replyWithCachedImage(ctx, caption, options) {
    const fullOptions = { caption, ...options };

    const cachedImageFileId = await FileIdService.get(IMAGE_KEY);
    if (cachedImageFileId) {
        return ctx.replyWithPhoto(cachedImageFileId, fullOptions);
    }

    const msg = await ctx.replyWithPhoto(new InputFile(DEFAULT_IMAGE_PATH), fullOptions);

    if (msg.photo?.length > 0) {
        FileIdService.set(IMAGE_KEY, msg.photo[msg.photo.length - 1].file_id);
    }

    return msg;
}

export async function handleHelp(ctx) {
    ctx.session.step = "idle";
    
    const helpText =
        `📃 <b>Bot haqida:</b>\n` +
        `<blockquote><i>📽️ <b>${BRAND.name} — </b> ${BRAND.plural}ni tez, qulay va oson topish uchun yaratilgan Telegram boti. Bot orqali ${BRAND.item} nomi, maxsus kodi yoki sun'iy intellekt (AI) qidiruvi yordamida kerakli ${BRAND.item}ni topishingiz mumkin.\n\n` +
        `🤖 Bot muntazam ravishda yangilanib boriladi va foydalanuvchilarga sifatli hamda qulay xizmat ko'rsatishni maqsad qiladi. Oddiy va tushunarli interfeys tufayli kerakli ${BRAND.item}ni bir necha soniya ichida topishingiz mumkin.\n\n` +
        `⭐ ${BRAND.name} bilan sevimli ${BRAND.plural}ingizni izlash yanada oson va qulay!</i></blockquote>\n\n` +
        `⚙️ <b>Bot buyruqlari:</b>\n` +
        `<blockquote><b>/start — </b> <i>Botni qayta ishga tushirish</i>\n` +
        `<b>/help — </b> <i>Bot bo'yicha to'liq qo'llanma</i>\n` +
        `<b>/search — </b> <i>Sun'iy intellekt orqali matnli qidiruv</i>\n` +
        `<b>/code — </b> <i>Raqamli kod orqali qidiruv</i>\n` +
        `<b>/${BRAND.listCommand} — </b> <i>Botdagi barcha ${BRAND.plural} ro'yxati</i></blockquote>`;

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
                const cachedImageFileId = await FileIdService.get(IMAGE_KEY);
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
                    FileIdService.set(IMAGE_KEY, updatedMsg.photo[updatedMsg.photo.length - 1].file_id);
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