import { InlineKeyboard, Keyboard } from "grammy";
import { ApiService } from "../services/api.service.js";

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"');
}

function buildContactRequestKeyboard() {
    return new Keyboard()
        .text("❌ Bekor qilish")
        .row()
        .requestContact("📩 Raqamni yuborish")
        .oneTime()
        .resized();
}

export async function handleVerifyAdmin(ctx) {
    ctx.session.step = "awaiting_admin_contact";
    ctx.session.admin = {
        verifyToken: ctx.match.replace("verify_", ""),
    };

    const caption = `<b>🔒 Admin panelga bog’lanish</b>\n\n<blockquote><i>Telegram hisobingizni admin panelga bog‘lash uchun telefon raqamingizni (Contact) yuboring.</i></blockquote>`;

    await ctx.reply(caption, {
        parse_mode: "HTML",
        reply_markup: buildContactRequestKeyboard(),
        reply_parameters: { message_id: ctx.message.message_id },
    });
}

export async function handleAdminLoginStart(ctx) {
    ctx.session.step = "awaiting_admin_contact";
    ctx.session.admin = {
        verifyToken: null,
    };

    const caption = `<b>🔒 Admin panelga kirish</b>\n\n<blockquote><i>Admin panelga Telegram hisob orqali kirish uchun telefon raqamingizni (Contact) yuboring.</i></blockquote>`;

    await ctx.reply(caption, {
        parse_mode: "HTML",
        reply_markup: buildContactRequestKeyboard(),
        reply_parameters: { message_id: ctx.message.message_id },
    });
}

export async function handleAdminContact(ctx) {
    if (!ctx.message?.contact) {
        return;
    }

    const from = ctx.from || {};
    const phoneNumber = ctx.message.contact.phone_number;
    const userId = from.id;
    const verifyToken = ctx.session.admin?.verifyToken;

    await ctx.reply("⏳ Iltimos kuting, tekshirilmoqda...", {
        reply_markup: { remove_keyboard: true }
    });

    if (verifyToken) {
        try {
            const response = await ApiService.updateAdmin({
                verifyToken: verifyToken,
                telegramId: userId,
                telegramUsername: from.username || null,
                phoneNumber: phoneNumber,
                firstName: from.first_name || null,
                lastName: from.last_name || null,
            });

            const payload = response?.data || response;

            if (response && response.success) {
                ctx.session.step = "idle";
                ctx.session.admin = null;

                // Build direct login URL to make it seamless
                const panelUrl = payload.panelAuthUrl;

                const successText = `<b>✅ Hisobingiz tasdiqlandi!</b>\n\n<blockquote><i>Telegram hisobingiz orqali admin panelga kirish muvaffaqiyatli amalga oshirildi.</i></blockquote>`;

                await ctx.reply(successText, {
                    parse_mode: "HTML",
                    reply_markup: new InlineKeyboard().url("Admin Panel 🔑", panelUrl),
                });
            } else {
                const errorMsg = escapeHtml(payload?.message || "Ushbu tasdiqlash havolasi yaroqsiz yoki allaqachon foydalanilgan!");
                const failText = `<b>⚠️ Tasdiqlanmadi!</b>\n\n<blockquote><i>${errorMsg}</i></blockquote>`;

                await ctx.reply(failText, {
                    parse_mode: "HTML",
                });
                ctx.session.step = "idle";
                ctx.session.admin = null;
            }
        } catch (error) {
            console.error("[Bot] Admin tasdiqlashda xatolik:", error.message);
            await ctx.reply("❌ Server bilan bog'lanishda xatolik yuz berdi. Iltimos keyinroq qayta urinib ko'ring.");
            ctx.session.step = "idle";
            ctx.session.admin = null;
        }
    } else {
        try {
            const contactCheck = await ApiService.checkAdminContact({
                phoneNumber: phoneNumber,
                telegramId: userId,
                telegramUsername: from.username || null,
                firstName: from.first_name || null,
                lastName: from.last_name || null,
                authSessionToken: ctx.session.admin?.loginSessionToken
            });

            const payload = contactCheck?.data || contactCheck;
            const isApproved = payload?.success === true;

            if (isApproved) {
                ctx.session.step = "idle";
                ctx.session.admin = null;

                const successText = `<b>✅ Hisobingiz tasdiqlandi!</b>\n\n<blockquote><i>Telegram hisobingiz orqali admin panelga kirish muvaffaqiyatli amalga oshirildi.</i></blockquote>`;

                if (payload?.viaSocket) {
                    await ctx.reply(successText, { parse_mode: "HTML", reply_markup: { remove_keyboard: true } });
                } else {
                    await ctx.reply(successText, {
                        parse_mode: "HTML",
                        reply_markup: new InlineKeyboard().url("Admin Panel 🔑", payload.panelAuthUrl),
                    });
                }
            } else {
                const failText = `<b>⚠️ Hisob tasdiqlanmadi!</b>\n\n<blockquote><i>Ushbu Telegram hisobi uchun admin panelga kirish ruxsati mavjud emas.</i></blockquote>`;
                await ctx.reply(failText, {
                    parse_mode: "HTML",
                    reply_markup: { remove_keyboard: true }
                });
                
                const authSessionToken = ctx.session.admin?.loginSessionToken;
                ctx.session.step = "idle";
                ctx.session.admin = null;

                if (authSessionToken) {
                    ApiService.cancelAdminContact(authSessionToken).catch(() => {});
                }
            }
        } catch (error) {
            console.error("[Bot] Login tekshirishda xatolik:", error.message);
            await ctx.reply("❌ Server bilan bog'lanishda xatolik yuz berdi.");
            ctx.session.step = "idle";
            ctx.session.admin = null;
        }
    }
}

export async function handleAdminCancel(ctx) {
    const authSessionToken = ctx.session.admin?.loginSessionToken;
    ctx.session.step = "idle";
    ctx.session.admin = null;

    if (authSessionToken) {
        ApiService.cancelAdminContact(authSessionToken).catch(() => {});
    }

    const cancelText = `<b>❌ Kirish bekor qilindi</b>\n\n<blockquote><i>Admin panelga Telegram hisob orqali kirish bekor qilindi.</i></blockquote>`;

    await ctx.reply(cancelText, {
        parse_mode: "HTML",
        reply_markup: { remove_keyboard: true },
        reply_parameters: { message_id: ctx.message.message_id },
    });
}

export async function handleAdminTelegramLogin(ctx) {
    const token = ctx.match.replace("admin_login_", "");

    ctx.session.step = "awaiting_admin_contact";
    ctx.session.admin = {
        verifyToken: null,
        loginSessionToken: token
    };

    const caption = `<b>🔐 Avtomatik Web-kirish</b>\n\n<blockquote><i>Brauzer orqali avtomatik tizimga kirish uchun telefon raqamingizni (Contact) yuboring.</i></blockquote>`;

    await ctx.reply(caption, {
        parse_mode: "HTML",
        reply_markup: buildContactRequestKeyboard(),
        reply_parameters: { message_id: ctx.message.message_id },
    });
}
