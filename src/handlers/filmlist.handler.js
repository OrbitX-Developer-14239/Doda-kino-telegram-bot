import { ApiService } from "../services/api.service.js";
import { KeyboardFactory } from "../keyboards/inline.menus.js";
import { InputFile } from "grammy";
import { FilmsKeyboard } from "../keyboards/films.keyboard.js";
import { CONFIG } from "../config/index.js";

let cachedImageFileId = null;
const DEFAULT_IMAGE_PATH = "assets/images/films.png";
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

export async function handleFilms(ctx, page = 1) {
    try {
        const data = await ApiService.getAllFilms(page);

        if (!data || !data.films || data?.films?.length === 0) {
            const errorOptions = {
                reply_markup: KeyboardFactory.createBacktoHomeMenu(),
                reply_parameters: ctx.message ? { message_id: ctx.message.message_id } : undefined,
            };

            if (ctx.callbackQuery) {
                await ctx.editMessageCaption({ caption: "<blockquote>❌ Afsus, hech qanday film topilmadi.</blockquote>", ...errorOptions }).catch(() => {});
            } else {
                await ctx.reply("<blockquote>❌ Afsus, hech qanday film topilmadi.</blockquote>", errorOptions).catch(() => {});
            }
            return;
        }

        ctx.session.films = data.films;
        ctx.session.page = page;

        const films = data.films;
        const currentPage = data.pagination?.currentPage || page;
        const totalFilms = data.pagination?.totalFilms || films.length;
        const totalPages = data.pagination?.totalPages || Math.ceil(totalFilms / CONFIG.ITEMS_PER_PAGE);

        const lastFilmNumber = Math.min(currentPage * CONFIG.ITEMS_PER_PAGE, totalFilms);
        const firstFilmNumber = (currentPage - 1) * CONFIG.ITEMS_PER_PAGE + 1;

        const filmList = films.map((film, i) => {
            const globalIndex = firstFilmNumber + i;
            return `<b>${globalIndex}.</b> ${film.name} (${film.year || ''}) <b>•</b> 🆔: ${film.code}`;
        }).join("\n");

        const caption =
            `<b>🎬 Botdagi barcha filmlar ro'yxati</b>\n\n` +
            `<b>📄 Natijalar: ${firstFilmNumber}-${lastFilmNumber} / ${totalFilms}</b>\n\n` +
            `<blockquote>${filmList}</blockquote>`;

        const options = {
            parse_mode: "HTML",
            reply_markup: FilmsKeyboard.getFilmsKeyboard(films, currentPage, totalPages, totalFilms),
        };

        if (ctx.callbackQuery) {
            try {
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
            } catch (editError) {
                if (!editError.message.includes("message is not modified")) {
                    console.error("[FilmList] Edit message error:", editError.message);
                }
                
                await ctx.deleteMessage().catch(() => {});
                await replyWithCachedImage(ctx, caption, options);
            }
        } 
        else {
            await replyWithCachedImage(ctx, caption, {
                ...options,
                reply_parameters: ctx.message ? { message_id: ctx.message.message_id } : undefined,
            });
        }
    } catch (error) {
        console.error("[FilmList] handleFilms error:", error.message);
        try {
            if (ctx.callbackQuery) {
                await ctx.editMessageCaption({ caption: "❌ Tizimda xatolik yuz berdi." }).catch(() => {});
            } else {
                await ctx.reply("❌ Tizimda xatolik yuz berdi. Birozdan so'ng urinib ko'ring.").catch(() => {});
            }
        } catch (e) {
            console.error("[FilmList] Xabar yuborib bo'lmadi:", e.message);
        }
    }
}

export async function handleAllFilmsPageChange(ctx) {
    await ctx.answerCallbackQuery().catch(() => {});

    const page = parseInt(ctx.match[1]);
    await handleFilms(ctx, page);
}