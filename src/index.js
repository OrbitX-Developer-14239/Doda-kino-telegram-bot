import crypto from "crypto";
import express from "express";
import { Bot, webhookCallback } from "grammy";
import { limit } from "@grammyjs/ratelimiter";
import { hydrate } from "@grammyjs/hydrate";
import { run, sequentialize } from "@grammyjs/runner";
import { autoRetry } from "@grammyjs/auto-retry";
import { CONFIG } from "./config/index.js";
import { cache } from "./services/cache.service.js";
import { sessionMiddleware } from "./core/context.js";
import { subscriptionMiddleware } from "./middlewares/subscription.middleware.js";
import { setupBotProfile } from "./setup/bot.profile.js";
import { sendTokenToBackend, setupRoutes } from "./setup/bot.router.js";
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
bot.use(subscriptionMiddleware);

setupRoutes(bot);

const app = express();
app.use(express.json());

// Parallel startup: profile + getMe + channels & films prewarm —
// deploy'dan keyingi birinchi user ham keshdan tez javob oladi
const [, me] = await Promise.all([
    setupBotProfile(bot),
    bot.api.getMe(),
    ApiService.getRequiredChannels().catch(() => {}),
    ApiService.getAllFilms(1).catch(() => {}),
]);

// Token saqlash — background
sendTokenToBackend(CONFIG.BOT_TOKEN, me.username);

const ALLOWED_UPDATES = ["message", "callback_query", "chat_member", "chat_join_request"];

// Webhook URL'ini bilgan begonalar soxta update yubora olmasligi uchun
const WEBHOOK_SECRET = crypto
    .createHash("sha256")
    .update(CONFIG.BOT_TOKEN)
    .digest("hex");

let runner = null;

if (CONFIG.IS_PRODUCTION) {
    app.use(
        "/webhook",
        webhookCallback(bot, "express", {
            secretToken: WEBHOOK_SECRET,
            timeoutMilliseconds: 30_000,
        })
    );

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
