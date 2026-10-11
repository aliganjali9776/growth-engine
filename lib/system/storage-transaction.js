"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeTogether = writeTogether;
function writeTogether(storage, writes) {
    if (new Set(writes.map((w) => w.key)).size !== writes.length)
        throw new Error("کلید تکراری ذخیره‌سازی");
    for (const w of writes)
        if (storage.getItem(w.key) !== w.expected)
            throw new Error("اطلاعات در زبانه دیگری تغییر کرده است؛ صفحه را تازه کنید.");
    const done = [];
    try {
        for (const w of writes) {
            storage.setItem(w.key, w.value);
            done.push(w);
        }
    }
    catch {
        let restored = true;
        for (const w of done.reverse())
            try {
                if (w.expected === null)
                    storage.removeItem(w.key);
                else
                    storage.setItem(w.key, w.expected);
            }
            catch {
                restored = false;
            }
        throw new Error(restored
            ? "ذخیره ممکن نشد؛ تغییرات برگردانده شدند."
            : "ذخیره ناقص است؛ صفحه را تازه کرده و وضعیت تأیید و مرحله را بررسی کنید.");
    }
}
