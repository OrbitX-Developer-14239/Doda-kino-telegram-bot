import { InlineKeyboard } from "grammy";
import { CONFIG } from "../config/index.js";
import { addButtonRows } from "./keyboard.utils.js";

const PAGE_SIZE = CONFIG.ITEMS_PER_PAGE;
const FILM_COLUMNS = 6;

function addPaginationButtons(keyboard, currentPage, totalPages, callbackPrefix) {
    if (totalPages <= 1) return;

    const prevPage = currentPage > 1 ? currentPage - 1 : 1;
    const nextPage = currentPage < totalPages ? currentPage + 1 : totalPages;

    keyboard
        .text("⬅️", prevPage === currentPage ? "no_prev_page" : `${callbackPrefix}${prevPage}`)
        .style(prevPage === currentPage ? "danger" : "primary")
        .text(`${currentPage}/${totalPages}`, "current_page_status")
        .text("➡️", nextPage === currentPage ? "no_next_page" : `${callbackPrefix}${nextPage}`)
        .style(nextPage === currentPage ? "danger" : "primary")
        .row();
}

export const FilmsKeyboard = {
    searchKeyboard(films, ctx) {
        const keyboard = new InlineKeyboard();

        const totalPages = Math.max(Math.ceil(films.length / PAGE_SIZE), 1);
        const currentPage = Math.min(Math.max(ctx.session.page || 1, 1), totalPages);

        ctx.session.page = currentPage;
        ctx.session.totalPages = totalPages;

        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const currentFilms = films.slice(startIndex, startIndex + PAGE_SIZE);

        addButtonRows(keyboard, currentFilms, FILM_COLUMNS, (film, i) => ({
            label: `${startIndex + i + 1}`,
            data: `send_film_${film.code}`,
        }));

        addPaginationButtons(keyboard, currentPage, totalPages, "films_page_");

        keyboard.text("🔙 Orqaga", "btn_search_name");

        return keyboard;
    },

    getFilmsKeyboard(films, currentPage, totalPages) {
        const keyboard = new InlineKeyboard();
        const startIndex = (currentPage - 1) * PAGE_SIZE;

        addButtonRows(keyboard, films, FILM_COLUMNS, (film, i) => ({
            label: `${startIndex + i + 1}`,
            data: `send_film_${film.code}`,
        }));

        addPaginationButtons(keyboard, currentPage, totalPages, "all_films_page_");

        keyboard.text("🔙 Bosh sahifaga", "back_to_home");

        return keyboard;
    },
};
