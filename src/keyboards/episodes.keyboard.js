import { InlineKeyboard } from "grammy";
import { CONFIG } from "../config/index.js";
import { addButtonRows } from "./keyboard.utils.js";

const PAGE_SIZE = CONFIG.ITEMS_PER_PAGE;
const EPISODE_COLUMNS = 4;

export const EpisodesKeyboard = {
    getEpisodesKeyboard(episodes, ctx, filmCode) {
        const keyboard = new InlineKeyboard();
        const safeEpisodes = episodes || [];

        if (safeEpisodes.length === 0) {
            keyboard.text("📃 Malumotlar", `film_info_${filmCode}`).row();
            keyboard.text("🔙 Bosh sahifaga", "back_to_home");
            return keyboard;
        }

        const totalPages = Math.ceil(safeEpisodes.length / PAGE_SIZE);

        // Sahifa raqamini chegaraga sig'diramiz — sessiyada boshqa ro'yxatdan
        // qolgan katta raqam bo'lsa, qismlar umuman ko'rinmay qolmasin.
        const currentPage = Math.min(Math.max(ctx.session.page || 1, 1), totalPages);

        ctx.session.page = currentPage;
        ctx.session.totalPages = totalPages;

        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const currentEpisodes = safeEpisodes.slice(startIndex, startIndex + PAGE_SIZE);

        addButtonRows(keyboard, currentEpisodes, EPISODE_COLUMNS, (episode, i) => ({
            label: `${startIndex + i + 1}-qism`,
            data: `send_episode_${episode.code}`,
        }));

        if (totalPages > 1) {
            const prevPage = currentPage > 1 ? currentPage - 1 : 1;
            const nextPage = currentPage < totalPages ? currentPage + 1 : totalPages;

            keyboard
                .text("⬅️", prevPage === currentPage ? "no_prev_page" : `episodes_page_${filmCode}_${prevPage}`)
                .style(prevPage === currentPage ? "danger" : "primary")
                .text(`${currentPage}/${totalPages}`, "current_page_status")
                .text("➡️", nextPage === currentPage ? "no_next_page" : `episodes_page_${filmCode}_${nextPage}`)
                .style(nextPage === currentPage ? "danger" : "primary")
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
