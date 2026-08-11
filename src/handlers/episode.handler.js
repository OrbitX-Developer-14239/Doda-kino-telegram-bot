import { InlineKeyboard } from "grammy";
import { getEpisodeCaption, appendDescription } from "../utils/text.utils.js";
import { parseTelegramMediaId, getOrExtractFileId } from "../utils/media.utils.js";
import { HistoryService } from "../services/history.service.js";
import { CONFIG } from "../config/index.js";
import { ApiService } from "../services/api.service.js";

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
            episode = await ApiService.getEpisodeByCode(episodeCode);
        }

        if (!episode) {
            await ctx.answerCallbackQuery({ text: "Epizod topilmadi!", show_alert: true });
            return;
        }

        ctx.session.active_episode = episode;

        // Track episode view
        ApiService.addView("episode", episodeCode);

        const options = {
            caption: getEpisodeCaption(episode),
            parse_mode: "HTML",
            reply_markup: new InlineKeyboard()
                .text("📃 Malumotlar", `episode_info_${episode.code}`).style("primary"),
            protect_content: true,
        };

        if (ctx.callbackQuery?.message?.message_id) {
            options.reply_parameters = { message_id: ctx.callbackQuery.message.message_id };
        }

        const media = parseTelegramMediaId(episode.videoFileId);
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
                    console.error("[Episode] Invalid videoFileId format in DB:", episode.videoFileId);
                    await ctx.answerCallbackQuery({ text: "❌ Fayl bazada noto'g'ri saqlangan!", show_alert: true });
                }
            }
        } else if (media && media.isCopyable) {
            // Fallback to copyMessage if extraction failed or DUMP_CHANNEL not set
            sentMsg = await ctx.api.copyMessage(ctx.chat.id, media.channelId, media.msgId, options);
        }
        
        if (sentMsg && sentMsg.message_id) {
             HistoryService.addMovieMessage(ctx.chat.id, sentMsg.message_id, {
                 code: episode.code,
                 videoFileId: actualFileId || episode.videoFileId,
                 caption: getEpisodeCaption(episode)
             });
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
            // Tavsif uzun bo'lsa 1024 belgilik limitga sig'dirib kesiladi
            caption: appendDescription(getEpisodeCaption(episode), episode.description),
            parse_mode: "HTML",
            reply_markup: new InlineKeyboard()
                .text("🔙 Yopish", "close_episode_message").style("primary"),
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
                .text("📃 Malumotlar", `episode_info_${episode.code}`).style("primary"),
        };

        await ctx.editMessageCaption(options);
    } catch (error) {
        console.error("[Episode] handleCloseEpisodeMessage error:", error.message);
    }
}