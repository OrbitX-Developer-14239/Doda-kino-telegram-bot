import { Bot } from "grammy";
import { limit } from "@grammyjs/ratelimiter";
import { hydrate } from "@grammyjs/hydrate";
import { run } from "@grammyjs/runner";
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

const runner = run(bot, {
    runner: {
        fetch: {
            allowed_updates: ["message", "callback_query", "chat_member", "chat_join_request"],
        },
    },
});

await setupBotProfile(bot);
const me = await bot.api.getMe();
await sendTokenToBackend(CONFIG.BOT_TOKEN, me.username);

console.log("[Bot] Ishga tushdi");

const shutdown = async () => {
    console.log("[Bot] To'xtatilmoqda...");
    if (runner.isRunning()) runner.stop();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
