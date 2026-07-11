const BOT_START_TIME = Math.floor(Date.now() / 1000);
const EXPIRATION_TIME = 24 * 60 * 60; // 24 soat (sekundlarda)

export async function buttonMiddleware(ctx, next) {
    if (ctx.callbackQuery) {
        const msgDate = ctx.callbackQuery.message?.date;
        const now = Math.floor(Date.now() / 1000);

        if (msgDate) {
            const isBeforeRestart = msgDate < BOT_START_TIME;
            const isTooOld = (now - msgDate) > EXPIRATION_TIME;

            if (isBeforeRestart || isTooOld) {
                return await ctx.answerCallbackQuery({
                    text: "⚠️ Bu tugma eskirgan va o'chirilgan! Iltimos, botdan foydalanish uchun qaytadan /start yuboring.",
                    show_alert: true
                });
            }
        }
    }
    await next();
}
