import { isNumericCode } from "../utils/text.utils.js";
import { executeSearchByName, executeSearchByCode } from "./search.handler.js";
import { handleUnknownCommand } from "./unknownCommand.handler.js";

export async function textRouter(ctx) {
    const step = ctx.session.step;
    const text = ctx.message.text;

    if (step === "search_by_code") {
        if (isNumericCode(text)) {
            return executeSearchByCode(ctx);
        }
        await ctx.reply(
            "<b>⚠️ Iltimos, faqat raqamli kod yuboring.</b>\n" +
            "<blockquote>Masalan: <b>50001</b>, <b>12345</b></blockquote>",
            {
                parse_mode: "HTML",
                reply_parameters: { message_id: ctx.message.message_id },
            }
        );
        return;
    }

    if (isNumericCode(text)) {
        return executeSearchByCode(ctx);
    }

    if (step === "search_by_name") {
        return executeSearchByName(ctx);
    }

    return handleUnknownCommand(ctx);
}