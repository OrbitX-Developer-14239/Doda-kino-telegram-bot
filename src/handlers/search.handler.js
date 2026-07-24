import { InputFile, InlineKeyboard } from "grammy";
import { FilmsKeyboard } from "../keyboards/films.keyboard.js";
import { KeyboardFactory } from "../keyboards/inline.menus.js";
import { EpisodesKeyboard } from "../keyboards/episodes.keyboard.js";
import { ApiService } from "../services/api.service.js";
import { CONFIG } from "../config/index.js";
import { canceledSearches } from "../store/memory.store.js";
import { getFilmCaption, getEpisodeCaption, generateFilmsListMessage } from "../utils/text.utils.js";
import { parseTelegramMediaId, getOrExtractFileId } from "../utils/media.utils.js";
import { handleUnknownCommand } from "./unknownCommand.handler.js";
import { HistoryService } from "../services/history.service.js";

let cachedNameSearchFileId = null;
let cachedCodeSearchFileId = null;

const NAME_SEARCH_IMAGE_PATH = "assets/images/name-search.png";
const CODE_SEARCH_IMAGE_PATH = "assets/images/code-search.png";

export async function searchByName(ctx) {
    ctx.session.step = "search_by_name";

    if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery().catch(() => { });
    }

    const caption =
        `<b>🔍 Nom orqali qidirish:</b>\n` +
        `<blockquote><i>Filmni topish uchun unog nomini, biror sahnasini, qahramonlari ismini yoki film haqida esingizda qolgan qisqacha ma'lumotni yuboring.\n Sun'iy intellekt siz yuborgan ma'lumotni tahlil qilib, eng mos filmlarni topishga harakat qiladi. Ma'lumot qanchalik batafsil bo'lsa, qidiruv natijasi shunchalik aniq bo'ladi.</i></blockquote>\n\n` +
        `<b>📝 Misollar:</b>\n` +
        `<blockquote>• "Titanic"\n• "Bir bola sehrgarlar maktabiga boradi."\n• "Kosmosda omon qolish haqida film."\n• "Bosh qahramoni John Wick."</blockquote>`;

    const options = {
        parse_mode: "HTML",
        reply_markup: KeyboardFactory.createBacktoHomeMenu(),
    };

    if (ctx.callbackQuery) {
        try {
            if (ctx.callbackQuery.message?.text) {
                await ctx.deleteMessage().catch(() => { });
                const msg = await ctx.replyWithPhoto(cachedNameSearchFileId || new InputFile(NAME_SEARCH_IMAGE_PATH), { caption, ...options });
                if (!cachedNameSearchFileId && msg.photo?.length > 0) {
                    cachedNameSearchFileId = msg.photo[msg.photo.length - 1].file_id;
                }
            } else {
                const updatedMsg = await ctx.editMessageMedia(
                    {
                        type: "photo",
                        media: cachedNameSearchFileId || new InputFile(NAME_SEARCH_IMAGE_PATH),
                        caption: caption,
                        parse_mode: options.parse_mode
                    },
                    { reply_markup: options.reply_markup }
                );
                if (!cachedNameSearchFileId && updatedMsg.photo?.length > 0) {
                    cachedNameSearchFileId = updatedMsg.photo[updatedMsg.photo.length - 1].file_id;
                }
            }
        } catch (error) {
            console.error("[Search] searchByName edit error:", error.message);
            await ctx.deleteMessage().catch(() => { });
        }
    } else {
        const msg = await ctx.replyWithPhoto(cachedNameSearchFileId || new InputFile(NAME_SEARCH_IMAGE_PATH), {
            ...options,
            caption: caption,
            reply_parameters: ctx.message ? { message_id: ctx.message.message_id } : undefined,
        });
        if (!cachedNameSearchFileId && msg.photo?.length > 0) {
            cachedNameSearchFileId = msg.photo[msg.photo.length - 1].file_id;
        }
    }
}

export async function executeSearchByName(ctx) {
    const searchingMessage =
        `<blockquote><b>"${ctx.message.text}"</b> so'rovi bo'yicha tahlil qilinmoqda...</blockquote>\n\n` +
        `<i>⏳ Natijalar tayyorlanmoqda, biroz kuting...</i>`;

    const notFoundMessage =
        `<b>❌ Afsus, hech qanday mos film topilmadi.</b>\n` +
        `<blockquote><i>Qidiruv natijasida siz yuborgan ma'lumotga mos film aniqlanmadi.</i></blockquote>\n\n` +
        `<b>📝 Misollar:</b>` +
        `<blockquote>• Film nomini boshqacha yozing.\n• Film haqida ko'proq ma'lumot yuboring.\n• Esingizda qolgan sahna.\n• Aktyor yoki qahramon nomini yozing.\n• Voqealarni qisqacha tasvirlab bering.</blockquote>\n\n` +
        `<b><i>🤖 Sun'iy intellekt batafsilroq ma'lumot asosida aniqroq natijalarni topishga harakat qiladi.</i></b>`;

    try {
        const userText = ctx.message.text;
        ctx.session.searchQuery = userText;

        const waitMsg = await ctx.reply(searchingMessage, {
            parse_mode: "HTML",
            reply_markup: KeyboardFactory.cancelSearch(),
            reply_parameters: { message_id: ctx.message.message_id },
        });

        const films = await ApiService.searchFilm(userText);

        if (canceledSearches.has(waitMsg.message_id)) {
            canceledSearches.delete(waitMsg.message_id);
            return;
        }

        if (films && films.length > 0) {
            ctx.session.films = films;
            ctx.session.page = 1;

            const successMessage = generateFilmsListMessage(userText, films, 1);

            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => { });

            const msg = await ctx.replyWithPhoto(cachedNameSearchFileId || new InputFile(NAME_SEARCH_IMAGE_PATH), {
                caption: successMessage,
                parse_mode: "HTML",
                reply_markup: FilmsKeyboard.searchKeyboard(films, ctx),
                reply_parameters: ctx.message ? { message_id: ctx.message.message_id } : undefined,
            });
            if (!cachedNameSearchFileId && msg.photo?.length > 0) {
                cachedNameSearchFileId = msg.photo[msg.photo.length - 1].file_id;
            }
        } else {
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, notFoundMessage, {
                parse_mode: "HTML",
                reply_markup: KeyboardFactory.createBacktoHomeMenu(),
            }).catch(() => { });
        }
    } catch (error) {
        console.error("[Search] Name search error:", error.message);
        await ctx.reply("❌ Xatolik yuz berdi", {
            reply_markup: KeyboardFactory.createBacktoHomeMenu(),
            reply_parameters: ctx.message ? { message_id: ctx.message.message_id } : undefined,
        }).catch(() => { });
    }
}

export async function searchByCode(ctx) {
    ctx.session.step = "search_by_code";

    if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery().catch(() => { });
    }

    const caption =
        `<b>🆔 Kod orqali qidirish:</b>\n` +
        `<blockquote><i>Filmni topish uchun unga biriktirilgan kodini yuboring.</i></blockquote>\n\n`;

    const options = {
        parse_mode: "HTML",
        reply_markup: KeyboardFactory.createBacktoHomeMenu(),
    };

    if (ctx.callbackQuery) {
        try {
            if (ctx.callbackQuery.message?.text) {
                await ctx.deleteMessage().catch(() => { });
                const msg = await ctx.replyWithPhoto(cachedCodeSearchFileId || new InputFile(CODE_SEARCH_IMAGE_PATH), { caption, ...options });
                if (!cachedCodeSearchFileId && msg.photo?.length > 0) {
                    cachedCodeSearchFileId = msg.photo[msg.photo.length - 1].file_id;
                }
            } else {
                const updatedMsg = await ctx.editMessageMedia(
                    {
                        type: "photo",
                        media: cachedCodeSearchFileId || new InputFile(CODE_SEARCH_IMAGE_PATH),
                        caption: caption,
                        parse_mode: options.parse_mode
                    },
                    { reply_markup: options.reply_markup }
                );
                if (!cachedCodeSearchFileId && updatedMsg.photo?.length > 0) {
                    cachedCodeSearchFileId = updatedMsg.photo[updatedMsg.photo.length - 1].file_id;
                }
            }
        } catch (error) {
            console.error("[Search] searchByCode edit error:", error.message);
            await ctx.deleteMessage().catch(() => { });
        }
    } else {
        const msg = await ctx.replyWithPhoto(cachedCodeSearchFileId || new InputFile(CODE_SEARCH_IMAGE_PATH), {
            ...options,
            caption: caption,
            reply_parameters: ctx.message ? { message_id: ctx.message.message_id } : undefined,
        });
        if (!cachedCodeSearchFileId && msg.photo?.length > 0) {
            cachedCodeSearchFileId = msg.photo[msg.photo.length - 1].file_id;
        }
    }
}

export async function executeSearchByCode(ctx) {
    const code = ctx.message.text.trim();
    const numCode = Number(code);

    const waitMsg = await ctx.reply(
        `<blockquote><b>🆔 ${code}</b> kodi bo'yicha qidirilmoqda...</blockquote>\n\n` +
        `<i>⏳ Biroz kuting...</i>`,
        {
            parse_mode: "HTML",
            reply_parameters: { message_id: ctx.message.message_id },
        }
    );

    const notFoundMessage =
        `<b>❌ Afsus, hech qanday mos film topilmadi.</b>\n` +
        `<blockquote>Qidiruv natijasida siz yuborgan <b>"${code}"</b> kodiga mos film topilmadi.</blockquote>\n\n` +
        `<b><i>💡 Barcha kinolar ro'yxatini ko'rish uchun /films buyrug'ini yozing.</i></b>`;

    try {
        if (numCode < 50000) {
            const episode = await ApiService.getEpisodeByCode(code);

            if (!episode) {
                await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, notFoundMessage, {
                    parse_mode: "HTML",
                    reply_markup: KeyboardFactory.createBacktoHomeMenu(),
                }).catch(() => { });
                return;
            }

            const media = parseTelegramMediaId(episode.videoFileId);
            const options = {
                caption: getEpisodeCaption(episode),
                parse_mode: "HTML",
                reply_markup: new InlineKeyboard().text("📃 Malumotlar", `episode_info_${episode.code}`).style("primary"),
            };
            if (ctx.message?.message_id) {
                options.reply_parameters = { message_id: ctx.message.message_id };
            }

            let sentMsg = null;
            let actualFileId = media?.fileId || null;

            if (media && media.isCopyable) {
                actualFileId = await getOrExtractFileId(ctx, media.channelId, media.msgId);
            }

            if (actualFileId) {
                try {
                    sentMsg = await ctx.api.sendVideo(ctx.chat.id, actualFileId, options);
                } catch (videoError) {
                    try {
                        sentMsg = await ctx.api.sendDocument(ctx.chat.id, actualFileId, options);
                    } catch (documentError) {
                        console.error("[Search] Invalid videoFileId format in DB:", episode.videoFileId);
                        await ctx.api.sendMessage(ctx.chat.id, "❌ Fayl bazada noto'g'ri saqlangan. Iltimos adminlarga xabar bering.");
                    }
                }
            } else if (media && media.isCopyable) {
                sentMsg = await ctx.api.copyMessage(ctx.chat.id, media.channelId, media.msgId, options);
            }
            
            if (sentMsg && sentMsg.message_id) {
                HistoryService.addMovieMessage(ctx.chat.id, sentMsg.message_id, {
                    code: episode.code,
                    videoFileId: actualFileId || episode.videoFileId,
                    caption: getEpisodeCaption(episode)
                });
            }

            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => { });
        } else {
            const film = await ApiService.getFilmByCode(code);

            if (!film) {
                await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, notFoundMessage, {
                    parse_mode: "HTML",
                    reply_markup: KeyboardFactory.createBacktoHomeMenu(),
                }).catch(() => { });
                return;
            }

            ctx.session.active_film = film;
            ctx.session.active_film_id = code;
            ctx.session.page = 1;
            ctx.session.totalPages = 1;

            const caption = getFilmCaption(film);

            const posterMedia = parseTelegramMediaId(film.posterId);
            const options = {
                caption,
                parse_mode: "HTML",
                reply_markup: EpisodesKeyboard.getEpisodesKeyboard(film.episodes, ctx, code),
            };
            if (ctx.message?.message_id) {
                options.reply_parameters = { message_id: ctx.message.message_id };
            }

            try {
                if (posterMedia && posterMedia.isCopyable) {
                    await ctx.api.copyMessage(ctx.chat.id, posterMedia.channelId, posterMedia.msgId, options);
                } else if (posterMedia && posterMedia.fileId) {
                    await ctx.api.sendPhoto(ctx.chat.id, posterMedia.fileId, options);
                } else {
                    await handleUnknownCommand(ctx);
                }
            } catch (mediaError) {
                console.error("[Search] Film media jo'natishda xatolik:", mediaError.message);
                await handleUnknownCommand(ctx);
            }

            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => { });
        }
    } catch (error) {
        console.error("[Search] Code search error:", error.message);
        await ctx.api.editMessageText(
            ctx.chat.id,
            waitMsg.message_id,
            "❌ Xatolik yuz berdi",
            {
                reply_markup: KeyboardFactory.createBacktoHomeMenu(),
            }
        ).catch(() => { });
    }
}

export async function cancelSearchHandler(ctx) {
    const cancelMessage =
        `<b>❌ Qidiruv bekor qilindi.</b>\n` +
        `<blockquote><i>Yangi qidiruvni boshlash uchun film nomi yoki tavsifini yuboring.</i></blockquote>\n\n` +
        `<b>📝 Misollar:</b>\n` +
        `<blockquote>• "Titanic"\n• "Bir bola sehrgarlar maktabiga boradi."\n• "Kosmosda omon qolish haqida film."\n• "Bosh qahramoni John Wick."</blockquote>`;

    canceledSearches.add(ctx.callbackQuery.message.message_id);

    await ctx.answerCallbackQuery("Qidiruv bekor qilindi ❌").catch(() => { });

    try {
        if (ctx.callbackQuery.message?.text) {
            await ctx.editMessageText(cancelMessage, {
                parse_mode: "HTML",
                reply_markup: KeyboardFactory.createBacktoHomeMenu(),
            });
        } else {
            await ctx.editMessageCaption({
                caption: cancelMessage,
                parse_mode: "HTML",
                reply_markup: KeyboardFactory.createBacktoHomeMenu(),
            });
        }
    } catch (e) {
        if (!e.message.includes("message is not modified")) {
            console.error("[Search] cancelSearchHandler edit error:", e.message);
        }
    }
}