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
import { stepExpiryMiddleware } from "./middlewares/step.middleware.js";
import { setupBotProfile } from "./setup/bot.profile.js";
import { setupRoutes } from "./setup/bot.router.js";
import { ApiService } from "./services/api.service.js";
import { TTLSet } from "./store/memory.store.js";

await cache.connect();

const bot = new Bot(CONFIG.BOT_TOKEN);

// Telegram 429 (flood wait) qaytarsa avtomatik kutib qayta urinadi
bot.api.config.use(autoRetry({ maxRetryAttempts: 2, maxDelaySeconds: 5 }));

// Guruh va kanallardagi xabar/tugmalarga javob bermaslik
bot.use(async (ctx, next) => {
  if (
    ctx.update.message ||
    ctx.update.callback_query ||
    ctx.update.channel_post ||
    ctx.update.edited_channel_post
  ) {
    if (ctx.chat?.type !== "private") {
      return;
    }
  }

  return next();
});

// Limitdan oshganda userga faqat bir marta ogohlantirish yuboriladi —
// aks holda bot flood'ga flood bilan javob berib, o'zi 429'ga uchraydi.
const rateLimitWarned = new TTLSet(5000);

bot.use(
  limit({
    timeFrame: 1000,
    limit: 3,
    onLimitExceeded: async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId || rateLimitWarned.has(userId)) return;
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
    keyGenerator: (ctx) => ctx.from?.id?.toString(),
  })
);

// Bitta user update'lari ketma-ket, turli userlar PARALLEL qayta ishlanadi
bot.use(sequentialize((ctx) => ctx.from?.id?.toString() ?? ctx.chat?.id?.toString()));

bot.use(hydrate());
bot.use(sessionMiddleware);
bot.use(stepExpiryMiddleware);
bot.use(subscriptionMiddleware);

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
const ALLOWED_UPDATES = ["message", "callback_query", "chat_member", "my_chat_member", "chat_join_request"];

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
