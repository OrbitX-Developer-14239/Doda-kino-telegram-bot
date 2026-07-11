import { CONFIG } from "../config/index.js";

export function getFilmCaption(film) {
    return `<b>${film.name}</b>\n\n` +
        `<blockquote><b>📗 Qismlar:</b> ${film.episodesCount} ta\n` +
        `<b>📅 Chiqarilgan:</b> ${film.year}-yil\n` +
        `<b>🚩 Mamlakat:</b> ${film.country}\n` +
        `<b>🆔 Film Kodi:</b> ${film.code}\n` +
        `<b>🎞 Janrlar:</b> <i>${film.genres?.join(", ") || "Mavjud emas"}</i></blockquote>`;
}

export function getEpisodeCaption(episode) {
    return `<b>${episode.name}</b>\n\n` +
        `<blockquote><b>📅 Chiqarilgan:</b> ${episode.releaseYear}\n` +
        `<b>🆔 Epizod Kodi:</b> ${episode.code}\n` +
        `<b>🎞 Janrlar:</b> <i>${episode.genres ? episode.genres.join(", ") : "Mavjud emas"}</i></blockquote>`;
}
export function generateFilmsListMessage(userText, films, page = 1) {
    const pageSize = CONFIG.ITEMS_PER_PAGE;
    const startIdx = (page - 1) * pageSize;
    const currentFilms = films.slice(startIdx, startIdx + pageSize);

    const listText = currentFilms.map((film, index) => {
        const globalIndex = startIdx + index + 1;
        return `<b>${globalIndex}.</b> ${film.name} (${film.year}) • 🆔: ${film.code}`;
    }).join("\n");

    return `<b>"${userText}"</b> so'rovi bo'yicha topilgan natijalar:\n\n` +
        `<b>📄 Natijalar: ${startIdx + 1}-${startIdx + currentFilms.length} / ${films.length}</b>\n` +
        `<blockquote>${listText}</blockquote>`;
}

export function isNumericCode(str) {
    if (!str) return false;
    return /^\d+$/.test(str.trim());
}
