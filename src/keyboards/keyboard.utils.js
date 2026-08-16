/**
 * Tugma qatorlarini qurish uchun umumiy yordamchilar.
 *
 * Ilgari har bir klaviatura qator uzilishini o'zi hisoblardi va buni IKKI xil
 * mantiq bilan qilardi (teng bo'lish yoki `% columnsPerRow`), oxirgi uzilish
 * esa faqat bittasiga mos kelardi. Natijada, masalan, oxirgi sahifada 8 ta
 * qism bo'lsa (8 % 4 === 0), uzilish umuman qo'yilmay, navigatsiya tugmalari
 * qismlar qatoriga yopishib qolardi.
 */

/**
 * Tugmalar sonini qatorlarga TENG taqsimlaydi.
 * Har bir qatorda `columnsPerRow` dan ko'p tugma bo'lmasligi kafolatlanadi.
 *
 * Masalan (columnsPerRow = 4):
 *   8 -> [4, 4]      6 -> [3, 3]      5  -> [3, 2]
 *   9 -> [3, 3, 3]   11 -> [4, 4, 3]  12 -> [4, 4, 4]
 */
export function balancedRowSizes(count, columnsPerRow) {
    if (count <= 0) return [];

    const rowCount = Math.ceil(count / columnsPerRow);
    const base = Math.floor(count / rowCount);
    const extra = count % rowCount;

    return Array.from({ length: rowCount }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Tugmalarni teng qatorlarga joylaydi va bo'limni yopadi — shundan keyin
 * qo'shiladigan tugmalar (navigatsiya va h.k.) HAR DOIM yangi qatordan boshlanadi.
 *
 * @param {import("grammy").InlineKeyboard} keyboard
 * @param {Array} items
 * @param {number} columnsPerRow - bir qatordagi maksimal tugmalar soni
 * @param {(item: any, index: number) => {label: string, data: string}} buildButton
 */
export function addButtonRows(keyboard, items, columnsPerRow, buildButton) {
    if (!items || items.length === 0) return keyboard;

    const sizes = balancedRowSizes(items.length, columnsPerRow);
    let index = 0;

    for (let rowIndex = 0; rowIndex < sizes.length; rowIndex++) {
        // Birinchi qator allaqachon mavjud (InlineKeyboard [[]] bilan boshlanadi) —
        // shuning uchun faqat keyingilari oldidan uzamiz, bo'sh qator hosil bo'lmaydi.
        if (rowIndex > 0) keyboard.row();

        for (let i = 0; i < sizes[rowIndex]; i++) {
            const { label, data } = buildButton(items[index], index);
            keyboard.text(label, data);
            index++;
        }
    }

    keyboard.row();
    return keyboard;
}
