import { InlineKeyboard } from "grammy";
import { CONFIG } from "../config/index.js";
import { ApiService } from "../services/api.service.js";
import { cache } from "../services/cache.service.js";

/**
 * ============================================
 *  Reklama tarqatish — kanaldagi suhbat
 * ============================================
 *
 * Oqim:
 *   1. Admin reklama kanaliga post tashlaydi
 *   2. Bot o'sha postga REPLY qilib "ulashamizmi?" deb so'raydi (Ha/Yo'q)
 *   3. Ha  -> necha marta yuborilsin (raqam)
 *   4. >1  -> orasidagi vaqt necha soat (butun raqam)
 *   5. Qaysi botlarga (ro'yxatdan belgilanadi) -> Davom etish
 *   6. Yakuniy tasdiq -> backend tarqatmani boshlaydi
 *
 * HOLAT REDIS DA: kanalda grammY sessiyasi yo'q (sessiya foydalanuvchi
 * bo'yicha ishlaydi, kanal posti esa nomidan kelmaydi). Shuning uchun
 * suhbat holati botning o'z savol xabari IDsi bo'yicha saqlanadi.
 *
 * Raqamlar kanalga oddiy post sifatida yuboriladi va bot ularni
 * o'qib bo'lgach O'CHIRADI — kanal toza qoladi.
 */

const STATE_TTL = 30 * 60;          // suhbat 30 daqiqada eskiradi
const stateKey = (chatId) => `b${CONFIG.BOT_ID}:adflow:${chatId}`;

const readState = async () => {
    try {
        return (await cache.get(stateKey(CONFIG.AD_CHANNEL_ID))) || null;
    } catch {
        return null;
    }
};

const writeState = (state) =>
    cache.set(stateKey(CONFIG.AD_CHANNEL_ID), state, STATE_TTL).catch(() => { });

const clearState = () => cache.del(stateKey(CONFIG.AD_CHANNEL_ID)).catch(() => { });

/** Faqat butun musbat raqam. "2." , "1.5", "ikki" — hammasi rad etiladi. */
const parseWholeNumber = (text) => {
    const clean = String(text || "").trim();
    if (!/^\d+$/.test(clean)) return null;
    const n = Number(clean);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
};

const isAdChannel = (ctx) =>
    CONFIG.AD_CHANNEL_ID && String(ctx.chat?.id) === String(CONFIG.AD_CHANNEL_ID);

// ── 1-qadam: yangi post -> taklif ────────────────────────────────────────────

export async function handleAdChannelPost(ctx) {
    if (!isAdChannel(ctx)) return;

    const post = ctx.channelPost;
    if (!post) return;

    const state = await readState();

    // Suhbat davom etayotgan bo'lsa, bu post — javob (raqam)
    if (state && state.step !== "idle") {
        return handleAnswer(ctx, state, post);
    }

    // Botning o'z xabarlariga javob bermaymiz
    if (post.from?.is_bot) return;

    const keyboard = new InlineKeyboard()
        .text("✅ Ha, ulashamiz", `ad_yes_${post.message_id}`)
        .text("❌ Yo'q", `ad_no_${post.message_id}`);

    const asked = await ctx.reply(
        "📣 <b>Ushbu postni bot foydalanuvchilariga ulashamizmi?</b>\n\n" +
        "<blockquote><i>Post o'zgarishsiz, botning o'z xabari ko'rinishida yuboriladi.</i></blockquote>",
        {
            parse_mode: "HTML",
            reply_parameters: { message_id: post.message_id },
            reply_markup: keyboard,
        }
    ).catch(() => null);

    if (asked) {
        await writeState({
            step: "awaiting_choice",
            postId: post.message_id,
            promptId: asked.message_id,
        });
    }
}

// ── 2-qadam: Ha / Yo'q ───────────────────────────────────────────────────────

export async function handleAdYes(ctx) {
    await ctx.answerCallbackQuery().catch(() => { });
    const postId = Number(ctx.match[1]);

    await writeState({ step: "awaiting_count", postId, promptId: ctx.callbackQuery.message.message_id });

    await ctx.editMessageText(
        "🔢 <b>Post necha marta yuborilsin?</b>\n\n" +
        "<blockquote><i>Raqam yuboring. Masalan: 1, 3, 5</i></blockquote>",
        { parse_mode: "HTML" }
    ).catch(() => { });
}

export async function handleAdNo(ctx) {
    await ctx.answerCallbackQuery({ text: "Bekor qilindi" }).catch(() => { });
    await clearState();
    await ctx.editMessageText("❌ <b>Bekor qilindi.</b> Post yuborilmadi.", { parse_mode: "HTML" })
        .catch(() => { });
}

// ── 3-4-qadam: raqamlar ──────────────────────────────────────────────────────

async function handleAnswer(ctx, state, post) {
    const text = post.text?.trim();

    // Faqat matnli javob kutamiz — rasm/video bo'lsa e'tiborsiz qoldiramiz
    if (!text) return;

    const value = parseWholeNumber(text);

    // Javobni kanaldan o'chiramiz — kanal toza qolsin
    await ctx.api.deleteMessage(ctx.chat.id, post.message_id).catch(() => { });

    if (state.step === "awaiting_count") {
        if (!value) {
            return editPrompt(ctx, state,
                "⚠️ <b>Iltimos, faqat raqam yuboring.</b>\n\n" +
                "<blockquote><i>Post necha marta yuborilsin? Masalan: 1, 3, 5</i></blockquote>"
            );
        }

        // Bir marta bo'lsa vaqt oralig'i so'ralmaydi
        if (value === 1) {
            await writeState({ ...state, step: "awaiting_bots", totalRuns: 1, intervalHours: 0 });
            return askBots(ctx, { ...state, totalRuns: 1, intervalHours: 0 });
        }

        await writeState({ ...state, step: "awaiting_interval", totalRuns: value });
        return editPrompt(ctx, state,
            `🔁 <b>${value} marta yuboriladi.</b>\n\n` +
            "⏱ <b>Xabarlar orasida necha soat vaqt bo'lsin?</b>\n\n" +
            "<blockquote><i>Butun soat yuboring: 1, 2, 8, 16.\n" +
            "Yarim soat (1.5) qabul qilinmaydi.</i></blockquote>"
        );
    }

    if (state.step === "awaiting_interval") {
        if (!value) {
            return editPrompt(ctx, state,
                "⚠️ <b>Iltimos, faqat butun raqam yuboring.</b>\n\n" +
                "<blockquote><i>Faqat soat bilan ishlaymiz: 1, 2, 8, 16.\n" +
                "1.5 kabi qiymatlar qabul qilinmaydi.</i></blockquote>"
            );
        }

        const next = { ...state, step: "awaiting_bots", intervalHours: value };
        await writeState(next);
        return askBots(ctx, next);
    }
}

async function editPrompt(ctx, state, html) {
    await ctx.api.editMessageText(ctx.chat.id, state.promptId, html, { parse_mode: "HTML" })
        .catch(() => { });
}

// ── 5-qadam: botlarni tanlash ────────────────────────────────────────────────

function botsKeyboard(targets, selected) {
    const keyboard = new InlineKeyboard();

    for (const t of targets) {
        const on = selected.includes(t.botId);
        const name = t.username ? `@${t.username}` : String(t.botId);
        keyboard.text(`${on ? "☑️" : "⬜️"} ${name} (${t.users})`, `ad_bot_${t.botId}`).row();
    }

    if (selected.length) keyboard.text("➡️ Davom etish", "ad_next").row();
    keyboard.text("❌ Bekor qilish", "ad_cancel");
    return keyboard;
}

async function askBots(ctx, state) {
    const targets = await ApiService.getBroadcastTargets();

    if (!targets.length) {
        await clearState();
        return editPrompt(ctx, state, "❌ <b>Botlar ro'yxatini olib bo'lmadi.</b>");
    }

    await writeState({ ...state, targets, selected: [] });

    await ctx.api.editMessageText(
        ctx.chat.id,
        state.promptId,
        "🤖 <b>Qaysi botlarning foydalanuvchilariga yuborilsin?</b>\n\n" +
        "<blockquote><i>Belgilash uchun bosing. Qavs ichida — foydalanuvchilar soni.</i></blockquote>",
        { parse_mode: "HTML", reply_markup: botsKeyboard(targets, []) }
    ).catch(() => { });
}

export async function handleAdBotToggle(ctx) {
    const state = await readState();
    if (!state?.targets) return ctx.answerCallbackQuery({ text: "Suhbat eskirgan" }).catch(() => { });

    const botId = Number(ctx.match[1]);
    const selected = state.selected || [];
    const next = selected.includes(botId)
        ? selected.filter((id) => id !== botId)
        : [...selected, botId];

    await writeState({ ...state, selected: next });
    await ctx.answerCallbackQuery().catch(() => { });

    await ctx.editMessageReplyMarkup({ reply_markup: botsKeyboard(state.targets, next) })
        .catch(() => { });
}

// ── 6-qadam: yakuniy tasdiq ──────────────────────────────────────────────────

export async function handleAdNext(ctx) {
    const state = await readState();
    if (!state?.selected?.length) {
        return ctx.answerCallbackQuery({ text: "Avval kamida bitta bot tanlang" }).catch(() => { });
    }
    await ctx.answerCallbackQuery().catch(() => { });

    const names = state.targets
        .filter((t) => state.selected.includes(t.botId))
        .map((t) => (t.username ? `@${t.username}` : t.botId));

    const reach = state.targets
        .filter((t) => state.selected.includes(t.botId))
        .reduce((sum, t) => sum + (t.users || 0), 0);

    const times = state.totalRuns === 1
        ? "1 marta"
        : `${state.totalRuns} marta, orasida ${state.intervalHours} soat`;

    await writeState({ ...state, step: "awaiting_confirm" });

    await ctx.editMessageText(
        "📋 <b>Tasdiqlang</b>\n\n" +
        `<blockquote><b>Botlar:</b> ${names.join(", ")}\n` +
        `<b>Qamrov:</b> ~${reach.toLocaleString("uz-UZ")} foydalanuvchi\n` +
        `<b>Yuborish:</b> ${times}</blockquote>\n\n` +
        "<i>Tasdiqlasangiz birinchi yuborish darhol boshlanadi.</i>",
        {
            parse_mode: "HTML",
            reply_markup: new InlineKeyboard()
                .text("✅ Tasdiqlash", "ad_confirm")
                .text("❌ Bekor qilish", "ad_cancel"),
        }
    ).catch(() => { });
}

export async function handleAdConfirm(ctx) {
    const state = await readState();
    if (!state?.selected?.length) {
        return ctx.answerCallbackQuery({ text: "Suhbat eskirgan" }).catch(() => { });
    }
    await ctx.answerCallbackQuery({ text: "Boshlanmoqda..." }).catch(() => { });

    const res = await ApiService.createBroadcast({
        sourceChatId: String(ctx.chat.id),
        sourceMessageId: state.postId,
        botIds: state.selected,
        totalRuns: state.totalRuns,
        intervalHours: state.intervalHours,
        createdBy: { id: ctx.from?.id ?? null, name: ctx.from?.first_name ?? null },
    });

    await clearState();

    if (!res) {
        return ctx.editMessageText(
            "❌ <b>Tarqatmani boshlab bo'lmadi.</b>\n\n" +
            "<blockquote><i>Backend javob bermadi. Biroz o'tib qayta urinib ko'ring.</i></blockquote>",
            { parse_mode: "HTML" }
        ).catch(() => { });
    }

    await ctx.editMessageText(
        "✅ <b>Tarqatma boshlandi.</b>\n\n" +
        "<blockquote><i>Yuborish fonda davom etadi — bu bir necha o'n daqiqa " +
        "olishi mumkin. Natijani server jurnalidan ko'rish mumkin.</i></blockquote>",
        { parse_mode: "HTML" }
    ).catch(() => { });
}

export async function handleAdCancel(ctx) {
    await ctx.answerCallbackQuery({ text: "Bekor qilindi" }).catch(() => { });
    await clearState();
    await ctx.editMessageText("❌ <b>Bekor qilindi.</b> Post yuborilmadi.", { parse_mode: "HTML" })
        .catch(() => { });
}
