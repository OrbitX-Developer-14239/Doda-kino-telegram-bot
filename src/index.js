import crypto from "crypto";
import express from "express";
import { Bot } from "grammy";
import { limit } from "@grammyjs/ratelimiter";
import { hydrate } from "@grammyjs/hydrate";
import { run, sequentialize } from "@grammyjs/runner";
import { autoRetry } from "@grammyjs/auto-retry";
import { CONFIG } from "./config/index.js";
import { cache } from "./services/cache.service.js";
import { sessionMiddleware } from "./core/context.js";
import { subscriptionMiddleware } from "./middlewares/subscription.middleware.js";
import { registerMiddleware } from "./middlewares/register.middleware.js";
import { stepExpiryMiddleware } from "./middlewares/step.middleware.js";
import { setupBotProfile } from "./setup/bot.profile.js";
import { setupRoutes } from "./setup/bot.router.js";
import { ApiService } from "./services/api.service.js";
import { TTLSet } from "./store/memory.store.js";

await cache.connect();

/**
 * Telegram API so'rovi uchun MUDDAT.
 *
 * grammY ning o'z qiymati 500 soniya — ya'ni tarmoq tiqilib qolsa bitta
 * so'rov ~8 daqiqa osilib turadi. Quyidagi sequentialize esa bitta
 * foydalanuvchining update'larini QAT'IY navbat bilan qayta ishlaydi:
 * osilgan so'rov o'sha odamning keyingi hamma xabarini bloklaydi. Natijada
 * bot "aynan shu odam uchun o'lgandek" bo'ladi — xato ham, javob ham yo'q,
 * logda hech qanday iz qolmaydi (@aniflag_bot da aynan shunday bo'lgan).
 *
 * 60 soniya kichik rasm yuklash uchun yetarli, lekin osilgan so'rovni
 * tezda uzadi va navbat harakatga keladi.
 */
const bot = new Bot(CONFIG.BOT_TOKEN, { client: { timeoutSeconds: 60 } });

// Telegram 429 (flood wait) qaytarsa avtomatik kutib qayta urinadi
bot.api.config.use(autoRetry({ maxRetryAttempts: 2, maxDelaySeconds: 5 }));

/**
 * ============================================
 *  Tashxis izi — DEBUG_TRACE=1
 * ============================================
 *
 * Yoqilganda har update'ning yo'li logga tushadi: qachon kirdi, qaysi
 * bosqichgacha yetdi, har bir Telegram API chaqiruvi qancha vaqt oldi va
 * qachon tugadi. "Bot javob bermayapti, lekin logda hech narsa yo'q"
 * holatini aynan shu yechadi — osilgan joy darhol ko'rinadi.
 *
 * O'chiq holatda (odatiy) middleware'lar qo'shilmaydi, hech qanday
 * qo'shimcha yuk yo'q. Yoqish: DEBUG_TRACE=1 pm2 restart <bot> --update-env
 */
const TRACE = process.env.DEBUG_TRACE === "1";
const trace = (msg) => TRACE && console.log(`[Trace ${new Date().toISOString().slice(11, 23)}] ${msg}`);
// Bosqich belgisi: TRACE o'chiq bo'lsa bo'sh o'tkazgich
const checkpoint = (name) => TRACE
  ? async (ctx, next) => { trace(`  ${ctx.update.update_id} .. ${name}`); return next(); }
  : (ctx, next) => next();

if (TRACE) {
  bot.api.config.use(async (prev, method, payload, signal) => {
    const t0 = Date.now();
    const target = payload?.chat_id ?? "";
    try {
      const res = await prev(method, payload, signal);
      trace(`  API ${method}(${target}) ${res.ok ? "OK" : "XATO " + res.description} ${Date.now() - t0}ms`);
      return res;
    } catch (e) {
      trace(`  API ${method}(${target}) ULANISH XATOSI ${Date.now() - t0}ms: ${e.message}`);
      throw e;
    }
  });

  bot.use(async (ctx, next) => {
    const t0 = Date.now();
    const kind = Object.keys(ctx.update).find((k) => k !== "update_id");
    const what = ctx.message?.text ?? ctx.callbackQuery?.data ?? "";
    trace(`>> ${ctx.update.update_id} ${kind} from=${ctx.from?.id ?? "-"} chat=${ctx.chat?.id ?? "-"} "${what}"`);
    try {
      await next();
      trace(`<< ${ctx.update.update_id} tugadi ${Date.now() - t0}ms`);
    } catch (e) {
      trace(`<< ${ctx.update.update_id} XATO ${Date.now() - t0}ms: ${e.message}`);
      throw e;
    }
  });
}

// Guruh va kanallardagi xabar/tugmalarga javob bermaslik.
// ISTISNO: reklama kanali — u yerdagi postlar va tugmalar broadcast
// oqimini yuritadi, shuning uchun o'tkazib yuboriladi.
const isAdChannel = (ctx) =>
  CONFIG.AD_CHANNEL_ID && String(ctx.chat?.id) === String(CONFIG.AD_CHANNEL_ID);

bot.use(async (ctx, next) => {
  if (
    ctx.update.message ||
    ctx.update.callback_query ||
    ctx.update.channel_post ||
    ctx.update.edited_channel_post
  ) {
    if (ctx.chat?.type !== "private" && !isAdChannel(ctx)) {
      return;
    }
  }

  return next();
});

// Limitdan oshganda userga faqat bir marta ogohlantirish yuboriladi —
// aks holda bot flood'ga flood bilan javob berib, o'zi 429'ga uchraydi.
const rateLimitWarned = new TTLSet(5000);

/**
 * Tezlik chegarasi FAQAT shaxsiy suhbatdagi xabar va tugmalarga tegishli.
 *
 * NEGA SHART: ilgari kalit shunchaki ctx.from.id edi, ya'ni kanaldan
 * kelgan XIZMAT hodisalari (chat_member, my_chat_member) ham o'sha
 * odamning hisobiga yozilardi. Admin bir nechta botni bitta kanalga
 * qo'shganda har bot bir soniyada bir nechta shunday hodisa oladi va
 * limit darhol tugaydi — shundan keyin O'SHA administratorning botga
 * yozgan xabarlari jimgina tashlab yuborilardi. Tashqaridan bu "bot
 * javob bermay qo'ydi" bo'lib ko'rinadi, logda esa hech qanday iz yo'q.
 *
 * Ikkinchi nosozlik: ogohlantirish ctx.reply bilan yuborilgani uchun
 * hodisa kanaldan kelgan bo'lsa, xabar KANALGA post bo'lib tushardi.
 */
const isUserInteraction = (ctx) =>
  ctx.chat?.type === "private" && Boolean(ctx.update.message || ctx.update.callback_query);

bot.use(
  limit({
    timeFrame: 1000,
    limit: 3,
    onLimitExceeded: async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId || rateLimitWarned.has(userId)) return;
      // Ogohlantirish hech qachon kanalga tushmasin
      if (ctx.chat?.type !== "private") return;
      rateLimitWarned.add(userId);

      try {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({
            text: "Sabr qilishni o'rganing! ⏳\n\nIltimos, tugmalarni ketma-ket tez-tez bosmang.",
            show_alert: true,
          });
        } else {
          await ctx.reply("<blockquote><b>Iltimos, juda tez xabar yubormang! ⏳</b></blockquote>", { parse_mode: "HTML" });
        }
      } catch (err) {
        console.error("Ratelimit xabari yuborilmadi:", err);
      }
    },
    // Kalit qaytmasa plagin chegarani umuman qo'llamaydi — xizmat
    // hodisalari shu tariqa foydalanuvchining hisobidan chiqariladi.
    keyGenerator: (ctx) => (isUserInteraction(ctx) ? ctx.from?.id?.toString() : undefined),
  })
);

// Bitta user update'lari ketma-ket, turli userlar PARALLEL qayta ishlanadi
bot.use(checkpoint("chegara -> navbat"));
bot.use(sequentialize((ctx) => ctx.from?.id?.toString() ?? ctx.chat?.id?.toString()));

bot.use(checkpoint("navbat -> sessiya"));
bot.use(hydrate());
bot.use(sessionMiddleware);
bot.use(checkpoint("sessiya -> ro'yxat"));
bot.use(stepExpiryMiddleware);
// Obuna tekshiruvidan OLDIN: obunasi to'liq bo'lmagan odam ham
// bizning foydalanuvchimiz — u ham bazaga tushishi kerak
bot.use(registerMiddleware);
bot.use(checkpoint("ro'yxat -> obuna"));
bot.use(subscriptionMiddleware);

bot.use(checkpoint("obuna -> handler"));
setupRoutes(bot);

const app = express();
app.use(express.json());

// Parallel startup: profile + init + channels & films prewarm —
// deploy'dan keyingi birinchi user ham keshdan tez javob oladi
await Promise.all([
    setupBotProfile(bot),
    bot.init(),
    ApiService.getRequiredChannels().catch(() => {}),
    ApiService.getAllFilms(1).catch(() => {}),
]);
const me = bot.botInfo;

// Eslatma: ilgari bu yerda bot tokenini backendga yuborish bor edi.
// Multibotda OLIB TASHLANDI — tokenlar backend .env ida turadi, tarmoq
// orqali token yurmaydi va bot o'zini ro'yxatdan o'tkazishi shart emas.

// my_chat_member — BOTNING o'zi kanalga qo'shilgani / admin qilingani / chiqarilgani.
// Telegram bu turdagi yangilanishni faqat shu ro'yxatda bo'lsagina yuboradi.
// Usiz bot o'zi qaysi kanallarda borligini umuman bila olmaydi (Bot API da
// "chatlar ro'yxati" metodi yo'q), shuning uchun panel ro'yxati ham bo'sh qolardi.
// channel_post — reklama kanalidagi postlarni ko'rish uchun (broadcast oqimi)
const ALLOWED_UPDATES = ["message", "callback_query", "chat_member", "my_chat_member", "chat_join_request", "channel_post"];

// Webhook URL'ini bilgan begonalar soxta update yubora olmasligi uchun
const WEBHOOK_SECRET = crypto
    .createHash("sha256")
    .update(CONFIG.BOT_TOKEN)
    .digest("hex");

let runner = null;

if (CONFIG.IS_PRODUCTION) {
    // Telegram'ga DARHOL 200 qaytariladi, update esa fonda qayta ishlanadi.
    // webhookCallback ishlatilmaydi, chunki u handler tugashini kutib HTTP
    // so'rovni ochiq ushlab turadi — sequentialize navbati bilan qo'shilganda
    // "Request timed out" xatolariga va Telegram'ning qayta yuborishiga olib kelardi.
    app.post("/webhook", (req, res) => {
        if (req.headers["x-telegram-bot-api-secret-token"] !== WEBHOOK_SECRET) {
            return res.sendStatus(401);
        }

        res.sendStatus(200);

        if (req.body && typeof req.body.update_id === "number") {
            bot.handleUpdate(req.body).catch((err) => {
                console.error("[Bot] handleUpdate error:", err.message || err);
            });
        }
    });

    await bot.api.setWebhook(CONFIG.WEBHOOK_URL, {
        allowed_updates: ALLOWED_UPDATES,
        secret_token: WEBHOOK_SECRET,
        max_connections: 100,
    });
    console.log(`[Bot] Webhook muvaffaqiyatli o'rnatildi: ${CONFIG.WEBHOOK_URL} ✅`);
} else {
    console.log("[Bot] Local muhit aniqlandi. Loyiha runner (parallel long polling) rejimida ishlayapti. 🛠️");

    // Webhook qolib ketgan bo'lsa pollingga xalaqit beradi — tozalaymiz
    await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => {});

    runner = run(bot, {
        runner: {
            fetch: { allowed_updates: ALLOWED_UPDATES },
        },
    });
}

const server = app.listen(CONFIG.PORT, () => {
    console.log(`[Bot] Server ${CONFIG.PORT}-portda ishga tushdi 🚀`);
});

const shutdown = async () => {
    console.log("[Bot] To'xtatilmoqda...");
    try {
        if (runner?.isRunning()) {
            await runner.stop();
        }
    } catch (e) {
        console.error("[Bot] Runner to'xtatishda xato:", e.message);
    }
    server.close();
    process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
