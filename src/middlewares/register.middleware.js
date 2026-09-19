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

    // Botni bloklash / blokdan chiqarish (my_chat_member) — bu botga
    // "yozish" emas: bunday hodisa foydalanuvchini faol deb belgilab,
    // uning "bloklagan" holatini o'chirib yubormasligi kerak.
    if (ctx.update.my_chat_member) {
        return next();
    }

    if (!ctx.session.is_registered) {
        /**
         * Bayroq FAQAT saqlash muvaffaqiyatli bo’lgandan keyin qo’yiladi.
         *
         * Ilgari u so’rovdan OLDIN qo’yilardi: backend o’sha lahzada
         * javob bermasa (deploy, tarmoq), odam bazaga tushmasdi va sessiya
         * 7 kun yashagani uchun QAYTA URINILMASDI ham — haqiqiy
         * foydalanuvchi butunlay yo’qolardi.
         *
         * Natijani kutish kerak: sessiya middleware zanjiri tugagach
         * saqlanadi, ya’ni javobdan keyin qo’yilgan bayroq yozilmay qolardi.
         * Bu bitta foydalanuvchida haftada bir marta sodir bo’ladi.
         */
        const saved = await ApiService.createUser({
            telegram_id: ctx.from.id,
            username: ctx.from.username,
            first_name: ctx.from.first_name,
        });

        if (saved) ctx.session.is_registered = true;
    }

    return next();
}
