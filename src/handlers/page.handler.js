import { FilmsKeyboard } from "../keyboards/films.keyboard.js";
import { generateFilmsListMessage } from "../utils/text.utils.js";
import { ApiService } from "../services/api.service.js";

/**
 * Sahifalash: ro'yxat sessiyada saqlangan nusxadan chiziladi.
 *
 * Lekin admin panelda film tahrirlangan/o'chirilgan bo'lsa, o'sha nusxa
 * eskirgan bo'ladi. Buni bilish uchun backend oshirib turadigan versiya
 * raqami solishtiriladi — mos kelmasa ro'yxat qaytadan olinadi.
 */
export async function handlePageChange(ctx) {
    await ctx.answerCallbackQuery();

    const page = parseInt(ctx.match[1]);
    ctx.session.page = page;

    const searchQuery = ctx.session.searchQuery || "";
    let films = ctx.session.films || [];

    try {
        const currentVersion = await ApiService.getCacheVersion();

        if (films.length && ctx.session.filmsVersion !== currentVersion) {
            const fresh = searchQuery
                ? await ApiService.searchFilm(searchQuery)
                : (await ApiService.getAllFilms(page))?.films;

            if (Array.isArray(fresh) && fresh.length) {
                films = fresh;
                ctx.session.films = fresh;
            }
            ctx.session.filmsVersion = currentVersion;
        }
    } catch {
        // Versiyani tekshirib bo'lmadi — eski nusxa bilan davom etamiz,
        // sahifalash umuman ishlamay qolgandan ko'ra shu yaxshi.
    }

    const updatedMessage = generateFilmsListMessage(searchQuery, films, page);
    const keyboard = FilmsKeyboard.searchKeyboard(films, ctx);

    await ctx.editMessageText(updatedMessage, {
        parse_mode: "HTML",
        reply_markup: keyboard,
    });
}
