import { InlineKeyboard } from "grammy";
import { CONFIG } from "../config/index.js";

const PAGE_SIZE = CONFIG.ITEMS_PER_PAGE;

export const EpisodesKeyboard = {
    getEpisodesKeyboard(episodes, ctx, filmCode) {
        const keyboard = new InlineKeyboard();
        const safeEpisodes = episodes || [];

        if (safeEpisodes.length === 0) {
            keyboard.text("📃 Malumotlar", `film_info_${filmCode}`).row();
            keyboard.text("🔙 Bosh sahifaga", "back_to_home");
            return keyboard;
        }

        ctx.session.page = ctx.session.page || 1;
        ctx.session.totalPages = Math.ceil(safeEpisodes.length / PAGE_SIZE);

        const currentPage = ctx.session.page;
        const totalPages = ctx.session.totalPages;
        const columnsPerRow = 4;

        const currentEpisodes = safeEpisodes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

        currentEpisodes.forEach((episode, i) => {
            const globalIndex = (currentPage - 1) * PAGE_SIZE + i + 1;
            keyboard.text(`${globalIndex}-qism`, `send_episode_${episode.code}`);

            if (currentEpisodes.length < PAGE_SIZE && currentEpisodes.length > columnsPerRow) {
                const half = Math.ceil(currentEpisodes.length / 2);
                if (i === half - 1) {
                    keyboard.row();
                }
            } else if ((i + 1) % columnsPerRow === 0) {
                keyboard.row();
            }
        });

        if (currentEpisodes.length % columnsPerRow !== 0) {
            keyboard.row();
        }

        if (safeEpisodes.length > PAGE_SIZE) {
            const prevPage = currentPage > 1 ? currentPage - 1 : 1;
            const nextPage = currentPage < totalPages ? currentPage + 1 : totalPages;

            keyboard
                .text("⬅️", prevPage === currentPage ? "no_prev_page" : `episodes_page_${filmCode}_${prevPage}`)
                .style(currentPage === 1 ? "danger" : "primary")
                .text(`${currentPage}/${totalPages}`, "current_page_status")
                .text("➡️", nextPage === currentPage ? "no_next_page" : `episodes_page_${filmCode}_${nextPage}`)
                .style(currentPage === totalPages ? "danger" : "primary")
                .row();
        }

        keyboard.text("📃 Malumotlar", `film_info_${filmCode}`).row();
        keyboard.text("🔙 Bosh sahifaga", "back_to_home");

        return keyboard;
    },

    backKeyboard() {
        const keyboard = new InlineKeyboard();
        keyboard.text("🔙 Yopish", "close_message").style("primary");
        return keyboard;
    },
};