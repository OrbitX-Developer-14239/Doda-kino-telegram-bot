import express from "express";
import { Bot, webhookCallback } from "grammy";
import { limit } from "@grammyjs/ratelimiter";
import { hydrate } from "@grammyjs/hydrate";
import { CONFIG } from "./config/index.js";
import { cache } from "./services/cache.service.js";
import { sessionMiddleware } from "./core/context.js";
import { subscriptionMiddleware } from "./middlewares/subscription.middleware.js";
import { setupBotProfile } from "./setup/bot.profile.js";
import { sendTokenToBackend, setupRoutes } from "./setup/bot.router.js";
import { ApiService } from "./services/api.service.js";

await cache.connect();

const bot = new Bot(CONFIG.BOT_TOKEN);

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

bot.use(
  limit({
    timeFrame: 1000,
    limit: 3,
    onLimitExceeded: async (ctx) => {
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

bot.use(hydrate());
bot.use(sessionMiddleware);
bot.use(subscriptionMiddleware);

setupRoutes(bot);

const app = express();
app.use(express.json());

// Parallel startup: profile + getMe + channels prewarm
const [, me] = await Promise.all([
    setupBotProfile(bot),
    bot.api.getMe(),
    ApiService.getRequiredChannels().catch(() => {}),
]);

// Token saqlash — background
sendTokenToBackend(CONFIG.BOT_TOKEN, me.username);

if (process.env.NODE_ENV === "production") {
    app.use("/webhook", webhookCallback(bot, "express"));

    const WEBHOOK_URL = `https://dodakino.orbitx.uz/webhook`; 
    await bot.api.setWebhook(WEBHOOK_URL, {
        allowed_updates: ["message", "callback_query", "chat_member", "chat_join_request"],
    });
    console.log(`[Bot] Webhook muvaffaqiyatli o'rnatildi: ${WEBHOOK_URL} ✅`);
} else {
    console.log("[Bot] Local muhit aniqlandi. Webhook o'rnatilmadi, loyiha long polling (bot.start) rejimida ishlayapti. 🛠️");
    
    bot.start({
        allowed_updates: ["message", "callback_query", "chat_member", "chat_join_request"],
    });
}

const PORT = 5001; 
const server = app.listen(PORT, () => {
    console.log(`[Bot] Server ${PORT}-portda ishga tushdi 🚀`);
});

const shutdown = async () => {
    console.log("[Bot] To'xtatilmoqda...");
    server.close();
    process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
