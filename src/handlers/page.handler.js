import { FilmsKeyboard } from "../keyboards/films.keyboard.js";
import { generateFilmsListMessage } from "../utils/text.utils.js";
import { SessionData } from "../services/session-data.service.js";

/**
 * Qidiruv natijalari bo'yicha sahifalash.
 *
 * Natijalar sessiyada SAQLANMAYDI — ular `searchQuery` bo'yicha umumiy
 * Redis keshidan qayta o'qiladi. Shu sababli admin filmni tahrirlasa,
 * foydalanuvchi keyingi sahifaga o'tishi bilan yangi ma'lumotni ko'radi.
 */
export async function handlePageChange(ctx) {
    await ctx.answerCallbackQuery();

    const page = parseInt(ctx.match[1]);
    ctx.session.page = page;

    const searchQuery = ctx.session.searchQuery || "";
    const films = await SessionData.getFilmList(ctx);

    if (!films.length) {
        return;
    }

    const updatedMessage = generateFilmsListMessage(searchQuery, films, page);
    const keyboard = FilmsKeyboard.searchKeyboard(films, ctx);

    await ctx.editMessageText(updatedMessage, {
        parse_mode: "HTML",
        reply_markup: keyboard,
    });
}
