# ویزارد یارانه (lab)

هدف: مسیر شفاف ساخت دیسکت یارانه روی دیتابیس آزمایشی، مطابق سند «مراحل تهیه دیسکت یارانه مراکز».

## جریان

1. **خانواده دیسکت** — یارانه (مستمری جدا)
2. **محل تأمین** — انتخاب نوع → `INSERT MakeOverTransactions` (عنوان/تاریخ خودکار)
3. **محاسبه** — `EXEC CalculateMarakezYarane @TransactionId, @SupplyLocationId`
4. **بررسی** — تعداد `PayedMakeOvers` + نمونه لیست افراد
5. **لیست افراد** — اختیاری (ستون‌های ارمغان / دانلود دیسکت)
6. **تایید** — ساخت CSV هم‌ستون ارمغان و ذخیره در
   `\\sqlcluster\MSSQLSERVER\Docs\Documents\Diskette\{guid}-Marakez-CSV-Zihesab-{Id}.csv`
   سپس `UPDATE Key2`.
   - مسیر اصلی: نوشتن مستقیم از Node روی UNC (بدون `xp_cmdshell`)
   - اگر UNC از میزبان پنل قابل نوشتن نباشد → fallback به `EXEC ListExporMarakez`
   - حساب ویندوز اجرای Next باید Write روی آن share داشته باشد.

سقف/کف (`MakeOverSupplyLocationCenterCatagory`) در ویزارد نیست؛ مشاهده فقط‌خواندنی در
**تنظیمات › مبالغ یارانه** (`/settings/yarane-thresholds`).

## API

`GET/POST /api/wizard/yarane`  
actions: `create` | `calculate` | `review` | `approve`  
فقط وقتی `PAYDISK_USE_TEST_DB=true`.

## UI

`/request/new` → `YaraneWizard`
