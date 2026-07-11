import { InlineKeyboard } from "grammy";
import { CONFIG } from "../config/index.js";
import { getEpisodeCaption } from "../utils/text.utils.js";

export async function handleSendEpisode(ctx) {
    const episodeCode = Number(ctx.match[1])

    try {
        let episode = null;
        const film = ctx.session.active_film;
        if (film && film.episodes) {
            const found = film.episodes.find((ep) => String(ep.code) === String(episodeCode));
            if (found && found.videoFileId) {
                episode = found;
            }
        }

        if (!episode || !episode.videoFileId) {
            const { ApiService } = await import("../services/api.service.js");
            episode = await ApiService.getEpisodeByCode(episodeCode);
        }

        if (!episode) {
            await ctx.answerCallbackQuery({ text: "Epizod topilmadi!", show_alert: true });
            return;
        }

        ctx.session.active_episode = episode;

        const options = {
            caption: getEpisodeCaption(episode),
            parse_mode: "HTML",
            reply_markup: new InlineKeyboard()
                .text("📃 Malumotlar", `episode_info_${episode.code}`),
        };

        const isNumericVideoId = /^\d+$/.test(String(episode.videoFileId));
        if (isNumericVideoId) {
            await ctx.api.copyMessage(ctx.chat.id, CONFIG.CHANNEL_ID, Number(episode.videoFileId), options);
        } else {
            try {
                await ctx.api.sendVideo(ctx.chat.id, episode.videoFileId, options);
            } catch (videoError) {
                try {
                    await ctx.api.sendDocument(ctx.chat.id, episode.videoFileId, options);
                } catch (documentError) {
                    console.error("[Episode] Invalid videoFileId format in DB:", episode.videoFileId);
                    await ctx.answerCallbackQuery({ text: "❌ Fayl bazada noto'g'ri saqlangan!", show_alert: true });
                }
            }
        }

        await ctx.answerCallbackQuery();
    } catch (error) {
        console.error("[Episode] handleSendEpisode error:", error.message);
        await ctx.answerCallbackQuery("Xatolik yuz berdi!").catch(() => { });
    }
}

export async function handleEpisodeInfo(ctx) {
    const episodeCode = Number(ctx.match[1])

    try {
        let episode = ctx.session.active_episode;

        if (!episode || String(episode.code) !== String(episodeCode) || !episode.description) {
            const { ApiService } = await import("../services/api.service.js");
            episode = await ApiService.getEpisodeByCode(episodeCode);
        }

        if (!episode) {
            await ctx.answerCallbackQuery({ text: "Epizod topilmadi!", show_alert: true });
            return;
        }

        ctx.session.active_episode = episode;

        const options = {
            caption: getEpisodeCaption(episode) +
                `\n<blockquote><b>📃 Qisqacha Tafsif:</b>\n<i>${episode.description}</i></blockquote>`,
            parse_mode: "HTML",
            reply_markup: new InlineKeyboard()
                .text("🔙 Yopish", "close_episode_message"),
        };

        await ctx.editMessageCaption(options);

        await ctx.answerCallbackQuery();
    } catch (error) {
        console.error("[Episode] handleEpisodeInfo error:", error.message);
        await ctx.answerCallbackQuery("Xatolik yuz berdi!").catch(() => { });
    }
}

export async function handleCloseEpisodeMessage(ctx) {
    await ctx.answerCallbackQuery();

    try {
        const episode = ctx.session.active_episode;

        if (!episode) {
            return;
        }

        const options = {
            caption: getEpisodeCaption(episode),
            parse_mode: "HTML",
            reply_markup: new InlineKeyboard()
                .text("📃 Malumotlar", `episode_info_${episode.code}`),
        };

        await ctx.editMessageCaption(options);
    } catch (error) {
        console.error("[Episode] handleCloseEpisodeMessage error:", error.message);
    }
}