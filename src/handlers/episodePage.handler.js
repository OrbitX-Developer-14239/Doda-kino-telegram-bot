import { EpisodesKeyboard } from "../keyboards/episodes.keyboard.js";
import { getFilmCaption } from "../utils/text.utils.js";
import { ApiService } from "../services/api.service.js";

export async function handleEpisodePageChange(ctx) {
    await ctx.answerCallbackQuery();

    const filmCode = Number(ctx.match[1])
    const page = parseInt(ctx.match[2]);

    // Sessiyadagi nusxa emas, umumiy keshdan — qism qo'shilgan/o'chirilgan
    // bo'lsa ro'yxat darhol to'g'ri ko'rinadi.
    const film = await ApiService.getFilmByCode(filmCode);

    if (!film || !film.episodes) {
        return;
    }

    ctx.session.page = page;

    const caption = getFilmCaption(film);

    await ctx.editMessageCaption({
        caption,
        parse_mode: "HTML",
        reply_markup: EpisodesKeyboard.getEpisodesKeyboard(film.episodes, ctx, filmCode),
    });
}
