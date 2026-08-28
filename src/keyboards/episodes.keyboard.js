import { InlineKeyboard } from "grammy";
import { CONFIG } from "../config/index.js";
import { addButtonRows } from "./keyboard.utils.js";

const PAGE_SIZE = CONFIG.ITEMS_PER_PAGE;
const EPISODE_COLUMNS = 4;
const SEASON_COLUMNS = 4;

/** Faslga tegishli qismlar (fasl ko'rsatilmagan eski yozuvlar 1-faslga tegishli) */
export const episodesOfSeason = (episodes, season) =>
    (episodes || []).filter((e) => (Number(e.season) || 1) === Number(season));

export const EpisodesKeyboard = {
    /**
     * Fasl tugmalari: "1-fasl", "2-fasl", ... — bir qatorda 4 tadan.
     * Faqat fasllar soni 1 dan ko'p bo'lganda ishlatiladi.
     */
    getSeasonsKeyboard(film, filmCode) {
        const keyboard = new InlineKeyboard();
        const seasons = Number(film.seasonsCount) || 1;

        const items = Array.from({ length: seasons }, (_, i) => i + 1);
        addButtonRows(keyboard, items, SEASON_COLUMNS, (season) => ({
            label: `${season}-fasl`,
            data: `season_${filmCode}_${season}`,
        }));

        keyboard.text("📃 Malumotlar", `film_info_${filmCode}`).row();
        keyboard.text("🔙 Bosh sahifaga", "back_to_home");
        return keyboard;
    },

    /**
     * @param {number|null} season - berilsa faqat o'sha faslning qismlari
     *        ko'rsatiladi va "Fasllar" tugmasi qo'shiladi.
     */
    getEpisodesKeyboard(episodes, ctx, filmCode, season = null) {
        const keyboard = new InlineKeyboard();
        const safeEpisodes = season
            ? episodesOfSeason(episodes, season)
            : (episodes || []);

        if (safeEpisodes.length === 0) {
            if (season) keyboard.text("🔙 Fasllar", `seasons_${filmCode}`).row();
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

        // Ko'p faslli serialda fasllar ro'yxatiga qaytish tugmasi
        if (season) keyboard.text("🔙 Fasllar", `seasons_${filmCode}`).row();

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
