import { ApiService } from "../services/api.service.js";
import { EpisodesKeyboard } from "../keyboards/episodes.keyboard.js";
import { getFilmCaption } from "../utils/text.utils.js";
import { parseTelegramMediaId } from "../utils/media.utils.js";
import { handleUnknownCommand } from "./unknownCommand.handler.js";

export async function handleSendFilm(ctx) {
    const filmCode = Number(ctx.match[1])
    ctx.session.active_film_id = filmCode;
    ctx.session.page = 1;
    ctx.session.totalPages = 1;
    await ctx.answerCallbackQuery();

    try {
        let film = await ApiService.getFilmByCode(filmCode);

        if (!film) {
            return;
        }

        ctx.session.active_film = film;
        const caption = getFilmCaption(film);

        const episodes = film.episodes || [];

        const media = parseTelegramMediaId(film.posterId);
        const options = {
            caption,
            parse_mode: "HTML",
            reply_markup: EpisodesKeyboard.getEpisodesKeyboard(episodes, ctx, filmCode),
        };

        if (ctx.callbackQuery?.message?.message_id) {
            options.reply_parameters = { message_id: ctx.callbackQuery.message.message_id };
        }

        try {
            if (media && media.isCopyable) {
                await ctx.api.copyMessage(ctx.chat.id, media.channelId, media.msgId, options);
            } else if (media && media.fileId) {
                await ctx.api.sendPhoto(ctx.chat.id, media.fileId, options);
            } else {
                await handleUnknownCommand(ctx);
            }
        } catch (mediaError) {
            console.error("[Film] Media jo'natishda xatolik:", mediaError.message);
            // await ctx.api.sendMessage(ctx.chat.id, "❌ Ushbu filmning rasmi bazada noto'g'ri saqlangan yoki o'chib ketgan. Iltimos adminlarga xabar bering.");
            await handleUnknownCommand(ctx);
        }
    } catch (error) {
        console.error("[Film] handleSendFilm error:", error.message);
    }
}

export async function handleFilmInfo(ctx) {
    const filmCode = Number(ctx.match[1])
    ctx.session.active_film_id = filmCode
    ctx.session.page = 1;
    ctx.session.totalPages = 1;
    await ctx.answerCallbackQuery();

    try {
        let film = ctx.session.active_film;

        if (!film) {
            film = await ApiService.getFilmByCode(filmCode);
        }

        if (!film) {
            return;
        }

        ctx.session.active_film = film;

        const caption = getFilmCaption(film) +
            `\n\n<blockquote><b>📃 Qisqacha Tafsif:</b>\n<i>${film.description || "Tafsif mavjud emas"}</i></blockquote>`;

        await ctx.editMessageCaption({
            caption,
            parse_mode: "HTML",
            reply_markup: EpisodesKeyboard.backKeyboard(),
        });
    } catch (error) {
        console.error("[Film] handleFilmInfo error:", error.message);
    }
}

export async function handleCloseMessage(ctx) {
    await ctx.answerCallbackQuery();

    try {
        const film = ctx.session.active_film;

        if (!film) {
            return;
        }

        const caption = getFilmCaption(film);
        const episodes = film.episodes || [];

        await ctx.editMessageCaption({
            caption,
            parse_mode: "HTML",
            reply_markup: EpisodesKeyboard.getEpisodesKeyboard(episodes, ctx, film.code),
        });
    } catch (error) {
        console.error("[Film] handleCloseMessage error:", error.message);
    }
}
