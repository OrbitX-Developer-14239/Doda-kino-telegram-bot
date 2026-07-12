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

await cache.connect();

const bot = new Bot(CONFIG.BOT_TOKEN);

bot.use(
  limit({
    timeFrame: 1000,
    limit: 1,
    onLimitExceeded: async (ctx) => {
      try {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({
            text: "Sabr qilishni o'rganing! ⏳\n\nIltimos, tugmalarni ketma-ket tez-tez bosmang.",
            show_alert: true,
          });
        } else {
          await ctx.reply("Iltimos, juda tez xabar yubormang! ⏳");
        }
      } catch (err) {
        console.error("Ratelimit xabari yuborilmadi:", err);
      }
    },
    keyGenerator: (ctx) => ctx.from?.id.toString(),
  })
);

bot.use(hydrate());
bot.use(sessionMiddleware);
bot.use(subscriptionMiddleware);

setupRoutes(bot);

const app = express();
app.use(express.json());

await setupBotProfile(bot);
const me = await bot.api.getMe();
await sendTokenToBackend(CONFIG.BOT_TOKEN, me.username);

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

// Portni tinglash (Har ikkala muhitda ham Express porti yoniq turadi)
const PORT = 5001; 
const server = app.listen(PORT, () => {
    console.log(`[Bot] Server ${PORT}-portda ishga tushdi 🚀`);
});

// Xavfsiz o'chirish (Graceful Shutdown) mantiqlari
const shutdown = async () => {
    console.log("[Bot] To'xtatilmoqda...");
    server.close();
    process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);