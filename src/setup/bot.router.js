import { handleChatJoinRequest } from "../handlers/chatJoinRequest.handler.js";
import { handleChatMember } from "../handlers/chatMember.handler.js";
import { handleStart } from "../handlers/start.handler.js";
import { handleHelp } from "../handlers/help.handler.js";
import { searchByName, searchByCode, cancelSearchHandler } from "../handlers/search.handler.js";
import { textRouter } from "../handlers/text.router.js";
import { handlePageChange } from "../handlers/page.handler.js";
import { handleSendFilm, handleFilmInfo, handleCloseMessage } from "../handlers/film.handler.js";
import { handleEpisodeInfo, handleSendEpisode, handleCloseEpisodeMessage } from "../handlers/episode.handler.js";
import { handleEpisodePageChange } from "../handlers/episodePage.handler.js";
import { handleFilms, handleAllFilmsPageChange } from "../handlers/filmlist.handler.js";
import { handleUnknownCommand } from "../handlers/unknownCommand.handler.js";
import { handleAdminCancel, handleAdminContact, handleAdminLoginStart, handleVerifyAdmin, handleAdminTelegramLogin, handleAdminTelegramLink } from "../handlers/admin.handler.js";
import { ApiService } from "../services/api.service.js";
import { HistoryService } from "../services/history.service.js";


export function setupRoutes(bot) {
    bot.command("start", async (ctx) => {

        const startPayload = ctx.match;
        if (startPayload && startPayload.startsWith("verify_")) {
            return await handleVerifyAdmin(ctx);
        }
        if (startPayload === "login") {
            return await handleAdminLoginStart(ctx);
        }
        if (startPayload && startPayload.startsWith("admin_login_")) {
            return await handleAdminTelegramLogin(ctx);
        }
        if (startPayload && startPayload.startsWith("admin_link_")) {
            return await handleAdminTelegramLink(ctx);
        }
        await handleStart(ctx);
    });
    bot.command("help", handleHelp);
    bot.command("films", handleFilms);
    bot.command("search", searchByName);
    bot.command("code", searchByCode);

    bot.callbackQuery("check_subscription", async (ctx) => {
        await ctx.answerCallbackQuery("Obuna tasdiqlandi ✅").catch(() => { });
        await ctx.deleteMessage().catch(() => { });

        HistoryService.unlockUserMedia(ctx, ctx.from.id).catch(e => console.error(e));

        if (ctx.session.pending_text) {
            const pendingText = ctx.session.pending_text;
            ctx.session.pending_text = null;

            const originalMessageId = ctx.callbackQuery.message?.reply_to_message?.message_id || ctx.callbackQuery.message?.message_id;

            ctx.update.message = {
                text: pendingText,
                message_id: originalMessageId,
                from: ctx.from,
                chat: ctx.chat,
            };
            delete ctx.update.callback_query;

            if (pendingText === "/start") return await handleStart(ctx);
            if (pendingText === "/help") return await handleHelp(ctx);
            if (pendingText === "/films") return await handleFilms(ctx);
            if (pendingText === "/search") return await searchByName(ctx);
            if (pendingText === "/code") return await searchByCode(ctx);

            if (!pendingText.startsWith("/")) {
                return await textRouter(ctx);
            }
            return await handleUnknownCommand(ctx);
        }
    });
    bot.callbackQuery("btn_help", handleHelp);
    bot.callbackQuery("back_to_home", handleStart);
    bot.callbackQuery("btn_all_films", handleFilms);
    bot.callbackQuery("btn_search_name", searchByName);
    bot.callbackQuery("btn_search_code", searchByCode);
    bot.callbackQuery("cancel_search", cancelSearchHandler);
    bot.callbackQuery("close_message", handleCloseMessage);
    bot.callbackQuery("close_episode_message", handleCloseEpisodeMessage);

    bot.callbackQuery(/^already_subbed_/, (ctx) => {
        ctx.answerCallbackQuery({ text: "✅ Siz bu kanalga allaqachon obuna bo'lgansiz!", show_alert: true }).catch(() => { });
    });

    bot.callbackQuery(/^films_page_(\d+)$/, handlePageChange);
    bot.callbackQuery(/^send_film_(.+)$/, handleSendFilm);
    bot.callbackQuery(/^film_info_(.+)$/, handleFilmInfo);
    bot.callbackQuery(/^send_episode_(.+)$/, handleSendEpisode);
    bot.callbackQuery(/^all_films_page_(\d+)$/, handleAllFilmsPageChange);
    bot.callbackQuery(/^episode_info_(.+)$/, handleEpisodeInfo);
    bot.callbackQuery(/^episodes_page_(.+)_(\d+)$/, handleEpisodePageChange);

    bot.callbackQuery(/^(no_prev_page|no_next_page|current_page_status)$/, (ctx) => {
        ctx.answerCallbackQuery().catch(() => { });
    });

    bot.on("chat_join_request", handleChatJoinRequest);
    bot.on("chat_member", handleChatMember);
    bot.on("message:contact", handleAdminContact);

    bot.on("message:text", async (ctx) => {
        const text = ctx.message.text;

        if (text.startsWith("/")) {
            return await handleUnknownCommand(ctx);
        }

        if (ctx.session.step === "awaiting_admin_contact") {
            if (text === "❌ Bekor qilish") {
                return await handleAdminCancel(ctx);
            }

            await ctx.reply(
                "📱 Iltimos, yuqoridagi tugma orqali telefon raqamingizni yuboring.",
                {
                    reply_parameters: { message_id: ctx.message.message_id },
                }
            );
            return;
        }

        if (ctx.session.step === "awaiting_link_contact") {
            if (text === "❌ Bekor qilish") {
                return await handleAdminCancel(ctx);
            }

            await ctx.reply(
                "📱 Telegram hisobingizni ulash uchun yuqoridagi tugma orqali telefon raqamingizni yuboring.",
                {
                    reply_parameters: { message_id: ctx.message.message_id },
                }
            );
            return;
        }

        await textRouter(ctx);
    });

    bot.catch((err) => {
        console.error("[Bot] Global error:", err.message || err);
    });
}

export async function sendTokenToBackend(token, username, maxRetries = 10, delayMs = 3000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await ApiService.saveToken(token, username);
            if (response && (response.success !== false)) {
                console.log("[Bot] Token backend bazasiga muvaffaqiyatli saqlandi. ✅");
                return true;
            }
        } catch (error) {
            console.warn(`[Bot] Backend'ga token yuborish urunishi ${attempt}/${maxRetries} muvaffaqiyatsiz (${error.message}). Qayta urinib ko'rilmoqda...`);
        }

        if (attempt < maxRetries) {
            await new Promise((res) => setTimeout(res, delayMs));
        }
    }
    console.error("[Bot] Backend'ga token yuborishda maksimal urinishlar tugadi.");
    return false;
}