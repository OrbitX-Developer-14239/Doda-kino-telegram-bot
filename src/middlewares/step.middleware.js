/**
 * Rejim (step) muddati.
 *
 * Rejim BIR MARTALIK EMAS: foydalanuvchi "Nom orqali qidirish" ga bir marta
 * o'tsa, ketma-ket 2-3 ta qidiruv qilaverishi mumkin. Lekin rejim abadiy
 * qolib ketmasligi kerak — sessiya Redis'da 7 kun yashaydi va eski rejim
 * tufayli ancha keyin yozilgan tasodifiy matn ham qidiruvga aylanardi.
 *
 * Endi rejim oxirgi ishlatilganidan 24 soat o'tsa o'z-o'zidan "idle" bo'ladi,
 * ya'ni matn "Noma'lum buyruq" javobini oladi.
 */
export const STEP_TTL_MS = 24 * 60 * 60 * 1000;

/** Rejim shu update'da ishlatildi — 24 soatlik muddat qaytadan boshlanadi. */
export function touchStep(ctx) {
    if (ctx.session.step && ctx.session.step !== "idle") {
        ctx.session.step_at = Date.now();
    }
}

export async function stepExpiryMiddleware(ctx, next) {
    const session = ctx.session;
    const before = session.step || "idle";

    if (before !== "idle") {
        const lastUsed = session.step_at || 0;
        if (Date.now() - lastUsed > STEP_TTL_MS) {
            session.step = "idle";
            session.step_at = 0;
        }
    }

    await next();

    const after = session.step || "idle";

    if (after === "idle") {
        if (session.step_at) session.step_at = 0;
    } else if (after !== before) {
        // Rejimga endi kirildi — muddat shu paytdan boshlanadi.
        // (Rejim ishlatilganda muddat touchStep() orqali yangilanadi.)
        session.step_at = Date.now();
    }
}
