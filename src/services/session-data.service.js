import { ApiService } from "./api.service.js";

/**
 * ============================================
 *  Sessiya ma'lumotlari — NUSXA EMAS, KO'RSATKICH
 * ============================================
 *
 * Ilgari bot har bir foydalanuvchi sessiyasiga film/epizodning TO'LIQ
 * nusxasini yozardi (`session.films`, `session.active_film`,
 * `session.active_episode`). Bu ikki muammo tug'dirardi:
 *
 *   1) ISROF — o'lchangan sessiya 4.7 KB edi, shundan 96% i bir xil
 *      filmlarning takroriy nusxasi. 32 000 foydalanuvchida ~150 MB.
 *
 *   2) NOMUVOFIQLIK — admin filmni tahrirlasa, uni o'sha paytda ko'rib
 *      turgan har bir odamning sessiyasida ESKI nusxa qolib ketardi.
 *      Aynan shu sabab "Qutqaruv kuni" muammosi kelib chiqqan edi.
 *
 * Endi sessiyada faqat KOD saqlanadi, ma'lumotning o'zi umumiy Redis
 * keshidan o'qiladi. Kesh baribir Redis'da — ya'ni tezlik o'zgarmaydi,
 * lekin manba bitta bo'ladi va backend uni tahrirlashda bekor qiladi.
 */
export const SessionData = {
    /** Ochilgan film — sessiyadagi koddan umumiy keshga qarab olinadi */
    async getActiveFilm(ctx) {
        const code = ctx.session.active_film_id;
        if (!code) return null;
        return await ApiService.getFilmByCode(code);
    },

    /** Ochilgan qism */
    async getActiveEpisode(ctx) {
        const code = ctx.session.active_episode_code;
        if (!code) return null;
        return await ApiService.getEpisodeByCode(code);
    },

    /**
     * Ko'rilayotgan ro'yxat: qidiruv natijasi yoki umumiy ro'yxat.
     * Ikkalasi ham keshdan o'qiladi — sessiyada saqlanmaydi.
     */
    async getFilmList(ctx) {
        const query = ctx.session.searchQuery;
        if (query) {
            return await ApiService.searchFilm(query);
        }
        const data = await ApiService.getAllFilms(ctx.session.page || 1);
        return data?.films || [];
    },
};
