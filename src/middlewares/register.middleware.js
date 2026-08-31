import { ApiService } from "../services/api.service.js";

/**
 * ============================================
 *  Foydalanuvchini ro'yxatga olish
 * ============================================
 *
 * Bot bilan HAR QANDAY muloqot qilgan odam bazaga yoziladi — /start
 * bosgani, kod yuborgani yoki tugma bosgani farqi yo'q.
 *
 * NEGA ALOHIDA MIDDLEWARE:
 * Ilgari saqlash ikki joyda edi va ikkalasida ham teshik bor edi:
 *   1) /start ishlovchisi — faqat /start bosilganda
 *   2) obuna middleware'i — faqat majburiy kanal MAVJUD bo'lganda
 * Natijada kanalsiz botda kod yozgan odam hech qayerda saqlanmasdi.
 *
 * Bu yerda esa bitta shart: odam botga yozdi -> u bizning foydalanuvchimiz.
 *
 * Sessiya bayrog'i tufayli API ga haftada bir marta murojaat qilinadi
 * (sessiya muddati 7 kun), ya'ni har xabarda ortiqcha so'rov ketmaydi.
 */
export async function registerMiddleware(ctx, next) {
    // Faqat shaxsiy suhbat: kanal va guruh hodisalari foydalanuvchi emas
    if (ctx.chat?.type !== "private" || !ctx.from?.id || ctx.from.is_bot) {
        return next();
    }

    if (!ctx.session.is_registered) {
        ctx.session.is_registered = true;

        ApiService.createUser({
            telegram_id: ctx.from.id,
            username: ctx.from.username,
            first_name: ctx.from.first_name,
        }).catch((error) => console.error("[Register] createUser error:", error.message));
    }

    return next();
}
