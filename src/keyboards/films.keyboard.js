import { InlineKeyboard } from "grammy";
import { CONFIG } from "../config/index.js";

const PAGE_SIZE = CONFIG.ITEMS_PER_PAGE;

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

function addFilmButtons(keyboard, films, currentPage, columnsPerRow = 6) {
    films.forEach((film, i) => {
        const globalIndex = (currentPage - 1) * PAGE_SIZE + i + 1;
        keyboard.text(`${globalIndex}`, `send_film_${film.code}`);

        if (films.length < PAGE_SIZE && films.length > columnsPerRow) {
            const half = Math.ceil(films.length / 2);
            if (i === half - 1) {
                keyboard.row();
            }
        } else if ((i + 1) % columnsPerRow === 0) {
            keyboard.row();
        }
    });

    if (films.length % columnsPerRow !== 0) {
        keyboard.row();
    }
}

export const FilmsKeyboard = {
    searchKeyboard(films, ctx) {
        const keyboard = new InlineKeyboard();

        ctx.session.page = ctx.session.page || 1;
        ctx.session.totalPages = Math.ceil(films.length / PAGE_SIZE);

        const currentPage = ctx.session.page;
        const totalPages = ctx.session.totalPages;

        const currentFilms = films.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

        addFilmButtons(keyboard, currentFilms, currentPage, 6);
        addPaginationButtons(keyboard, currentPage, totalPages, "films_page_");

        keyboard.text("🔙 Orqaga", "btn_search_name");

        return keyboard;
    },

    getFilmsKeyboard(films, currentPage, totalPages, totalFilms) {
        const keyboard = new InlineKeyboard();

        films.forEach((film, i) => {
            const globalIndex = (currentPage - 1) * PAGE_SIZE + i + 1;
            keyboard.text(`${globalIndex}`, `send_film_${film.code}`);

            if (totalFilms < PAGE_SIZE && totalFilms > 6) {
                const half = Math.ceil(totalFilms / 2);
                if (i === half - 1) {
                    keyboard.row();
                }
            } else if ((i + 1) % 6 === 0) {
                keyboard.row();
            }
        });

        if (films.length % 6 !== 0) {
            keyboard.row();
        }

        addPaginationButtons(keyboard, currentPage, totalPages, "all_films_page_");

        keyboard.text("🔙 Bosh sahifaga", "back_to_home");

        return keyboard;
    },
};