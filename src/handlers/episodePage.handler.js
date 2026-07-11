import { EpisodesKeyboard } from "../keyboards/episodes.keyboard.js";
import { getFilmCaption } from "../utils/text.utils.js";

export async function handleEpisodePageChange(ctx) {
    await ctx.answerCallbackQuery();

    const filmCode = Number(ctx.match[1])
    const page = parseInt(ctx.match[2]);

    const film = ctx.session.active_film;

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
