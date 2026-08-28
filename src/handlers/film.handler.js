import { ApiService } from "../services/api.service.js";
import { BRAND } from "../config/branding.js";
import { EpisodesKeyboard } from "../keyboards/episodes.keyboard.js";
import { getFilmCaption, appendDescription } from "../utils/text.utils.js";
import { parseTelegramMediaId } from "../utils/media.utils.js";
import { handleUnknownCommand } from "./unknownCommand.handler.js";
import { SessionData } from "../services/session-data.service.js";

export async function handleSendFilm(ctx) {
    const filmCode = Number(ctx.match[1])
    ctx.session.active_film_id = filmCode;
    ctx.session.active_season = null;
    ctx.session.page = 1;
    ctx.session.totalPages = 1;
    await ctx.answerCallbackQuery();

    try {
        let film = await ApiService.getFilmByCode(filmCode);

        if (!film) {
            // Callback tepada allaqachon javoblangan — shuning uchun oddiy xabar
            await ctx.reply(`<blockquote>❌ ${BRAND.Item} topilmadi yoki o'chirilgan.</blockquote>`, { parse_mode: "HTML" }).catch(() => { });
            return;
        }

        // Nusxa saqlanmaydi — keyingi handlerlar active_film_id orqali
        // umumiy keshdan o'qiydi, shunda ma'lumot hech qachon eskirmaydi.
        const caption = getFilmCaption(film);   // fasl tanlanmagan

        // Orqa fonda (background) ko'rishlar sonini oshiramiz
        ApiService.addView("film", filmCode);

        const episodes = film.episodes || [];

        // Ko'p faslli serial bo'lsa avval FASL tugmalari ko'rsatiladi,
        // bir faslli bo'lsa (yoki fasl kiritilmagan bo'lsa) — to'g'ridan-to'g'ri qismlar.
        const seasons = Number(film.seasonsCount) || 1;
        const markup = seasons > 1
            ? EpisodesKeyboard.getSeasonsKeyboard(film, filmCode)
            : EpisodesKeyboard.getEpisodesKeyboard(episodes, ctx, filmCode);

        const media = parseTelegramMediaId(film.posterId);
        const options = {
            caption,
            parse_mode: "HTML",
            reply_markup: markup,
        };

        if (ctx.callbackQuery?.message?.message_id) {
            options.reply_parameters = { message_id: ctx.callbackQuery.message.message_id };
        }

        try {
            if (media && media.isCopyable) {
                await ctx.api.copyMessage(ctx.chat.id, media.channelId, media.msgId, options);
            } else if (media && media.fileId) {
                await ctx.api.sendPhoto(ctx.chat.id, media.fileId, options);
            } else {
                await handleUnknownCommand(ctx);
            }
        } catch (mediaError) {
            console.error("[Film] Media jo'natishda xatolik:", mediaError.message);
            // await ctx.api.sendMessage(ctx.chat.id, "❌ Ushbu filmning rasmi bazada noto'g'ri saqlangan yoki o'chib ketgan. Iltimos adminlarga xabar bering.");
            await handleUnknownCommand(ctx);
        }
    } catch (error) {
        console.error("[Film] handleSendFilm error:", error.message);
    }
}

export async function handleFilmInfo(ctx) {
    const filmCode = Number(ctx.match[1])
    ctx.session.active_film_id = filmCode
    ctx.session.page = 1;
    ctx.session.totalPages = 1;
    await ctx.answerCallbackQuery();

    try {
        // To'g'ridan-to'g'ri umumiy keshdan — sessiyadagi nusxa eskirishi mumkin edi
        const film = await ApiService.getFilmByCode(filmCode);

        if (!film) {
            return;
        }

        // Tavsif uzun bo'lsa 1024 belgilik limitga sig'dirib kesiladi
        const caption = appendDescription(getFilmCaption(film), film.description);

        await ctx.editMessageCaption({
            caption,
            parse_mode: "HTML",
            reply_markup: EpisodesKeyboard.backKeyboard(),
        });
    } catch (error) {
        console.error("[Film] handleFilmInfo error:", error.message);
    }
}

export async function handleCloseMessage(ctx) {
    await ctx.answerCallbackQuery();

    try {
        const film = await SessionData.getActiveFilm(ctx);

        if (!film) {
            return;
        }

        // "Malumotlar" dan qaytishda foydalanuvchi qayerda edi — o'sha ko'rinish:
        // fasl ochiq bo'lsa o'sha faslning qismlari, aks holda fasllar/qismlar ro'yxati.
        const season = ctx.session.active_season || null;
        const seasons = Number(film.seasonsCount) || 1;
        const episodes = film.episodes || [];

        const markup = (seasons > 1 && !season)
            ? EpisodesKeyboard.getSeasonsKeyboard(film, film.code)
            : EpisodesKeyboard.getEpisodesKeyboard(episodes, ctx, film.code, season);

        await ctx.editMessageCaption({
            caption: getFilmCaption(film, season),
            parse_mode: "HTML",
            reply_markup: markup,
        });
    } catch (error) {
        console.error("[Film] handleCloseMessage error:", error.message);
    }
}

/** Fasl tanlandi -> o'sha faslning qismlari */
export async function handleSeasonSelect(ctx) {
    await ctx.answerCallbackQuery();

    const filmCode = Number(ctx.match[1]);
    const season = Number(ctx.match[2]);

    ctx.session.active_film_id = filmCode;
    ctx.session.active_season = season;
    ctx.session.page = 1;

    try {
        const film = await ApiService.getFilmByCode(filmCode);
        if (!film) return;

        await ctx.editMessageCaption({
            caption: getFilmCaption(film, season),
            parse_mode: "HTML",
            reply_markup: EpisodesKeyboard.getEpisodesKeyboard(film.episodes || [], ctx, filmCode, season),
        });
    } catch (error) {
        if (!error.message?.includes("message is not modified")) {
            console.error("[Film] handleSeasonSelect error:", error.message);
        }
    }
}

/** Qismlardan fasllar ro'yxatiga qaytish */
export async function handleSeasonsBack(ctx) {
    await ctx.answerCallbackQuery();

    const filmCode = Number(ctx.match[1]);
    ctx.session.active_season = null;
    ctx.session.page = 1;

    try {
        const film = await ApiService.getFilmByCode(filmCode);
        if (!film) return;

        await ctx.editMessageCaption({
            caption: getFilmCaption(film),
            parse_mode: "HTML",
            reply_markup: EpisodesKeyboard.getSeasonsKeyboard(film, filmCode),
        });
    } catch (error) {
        if (!error.message?.includes("message is not modified")) {
            console.error("[Film] handleSeasonsBack error:", error.message);
        }
    }
}
