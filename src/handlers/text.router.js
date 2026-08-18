import { isNumericCode } from "../utils/text.utils.js";
import { executeSearchByName, executeSearchByCode } from "./search.handler.js";
import { handleUnknownCommand } from "./unknownCommand.handler.js";
import { touchStep } from "../middlewares/step.middleware.js";

export async function textRouter(ctx) {
    const step = ctx.session.step;
    const text = ctx.message.text;

    if (step === "search_by_code") {
        // Rejim ishlatildi — 24 soatlik muddat qaytadan boshlanadi
        touchStep(ctx);

        if (isNumericCode(text)) {
            return executeSearchByCode(ctx);
        }
        await ctx.reply(
            "<b>⚠️ Iltimos, faqat raqamli kod yuboring.</b>\n" +
            "<blockquote>Masalan: <b>50001</b>, <b>12345</b></blockquote>",
            {
                parse_mode: "HTML",
                reply_parameters: {
                    message_id: ctx.message.message_id,
                    allow_sending_without_reply: true
                },
            }
        );
        return;
    }

    if (isNumericCode(text)) {
        return executeSearchByCode(ctx);
    }

    if (step === "search_by_name") {
        // Rejim saqlanadi: ketma-ket bir necha marta qidirish mumkin.
        // Muddat esa har qidiruvda yangilanadi.
        touchStep(ctx);
        return executeSearchByName(ctx);
    }

    // Boshqa rejimda (yoki rejimsiz) yozilgan matn — noma'lum buyruq
    return handleUnknownCommand(ctx);
}
