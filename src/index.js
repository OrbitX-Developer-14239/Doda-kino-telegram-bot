import { Bot } from "grammy";
import { hydrate } from "@grammyjs/hydrate";
import { run } from "@grammyjs/runner";
import { CONFIG } from "./config/index.js";
import { cache } from "./services/cache.service.js";
import { sessionMiddleware } from "./core/context.js";
import { subscriptionMiddleware } from "./middlewares/subscription.middleware.js";
import { buttonMiddleware } from "./middlewares/button.middleware.js";


import { setupBotProfile } from "./setup/bot.profile.js";
import { sendTokenToBackend, setupRoutes } from "./setup/bot.router.js";

await cache.connect();

const bot = new Bot(CONFIG.BOT_TOKEN);
bot.use(hydrate());
bot.use(sessionMiddleware);
// bot.use(buttonMiddleware);
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
