import { FilmsKeyboard } from "../keyboards/films.keyboard.js";
import { generateFilmsListMessage } from "../utils/text.utils.js";

export async function handlePageChange(ctx) {
    await ctx.answerCallbackQuery();

    const page = parseInt(ctx.match[1]);
    ctx.session.page = page;

    const films = ctx.session.films || [];
    const searchQuery = ctx.session.searchQuery || "";

    const updatedMessage = generateFilmsListMessage(searchQuery, films, page);
    const keyboard = FilmsKeyboard.searchKeyboard(films, ctx);

    await ctx.editMessageText(updatedMessage, {
        parse_mode: "HTML",
        reply_markup: keyboard,
    });
}