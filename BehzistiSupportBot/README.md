# سامانه هوشمند پاسخگویی و پشتیبانی سازمانی

چت‌بات سازمانی برای پاسخ به سؤالات کاربران بر اساس:

- دانش سازمانی
- بخشنامه‌ها
- قوانین و ضوابط
- پاسخ‌های گذشته / FAQ

اگر پاسخ مطمئن یافت نشود (یا کاربر درخواست کند)، گفتگو به **کارشناس زنده** ارجاع می‌شود.

## اجرا

```bash
cd BehzistiSupportBot
npm install
npm run dev
# یا پورت دلخواه:
npm.cmd run dev -- -p 3040
```

- گفتگوی کاربر: [http://localhost:3040](http://localhost:3040)
- پنل کارشناس: [http://localhost:3040/agent](http://localhost:3040/agent)
- ویجت شناور قابل‌نصب در اپ‌ها: گوشه پایین صفحه (رنگ `#00BAD1` + ping)

راهنمای یکپارچه‌سازی: [`docs/INTEGRATION.md`](docs/INTEGRATION.md)  
Ollama (LLM محلی): [`docs/OLLAMA.md`](docs/OLLAMA.md)  
Didban RAG: [`docs/DIDBAN-RAG-TEST-PLAN.md`](docs/DIDBAN-RAG-TEST-PLAN.md)

### Ollama سریع

```powershell
# نصب از https://ollama.com/download سپس:
ollama pull llama3.2
# در .env.local: OLLAMA_MODEL=llama3.2
npm.cmd run dev -- -p 3040
# وضعیت: http://localhost:3040/api/ollama
```

## معماری فعلی (MVP)

| بخش | توضیح |
|------|--------|
| UI | Next.js + React، فارسی/RTL، برند بهزیستی |
| بازیابی دانش | جستجوی واژگانی روی فایل‌های JSON در `data/knowledge/` |
| جلسه گفتگو | ذخیره محلی در `data/runtime/sessions.json` |
| ارجاع زنده | صف `waiting_agent` → پذیرش کارشناس → گفتگوی دوطرفه |

## افزودن دانش

فایل‌های نمونه را در این مسیرها گسترش دهید:

- `data/knowledge/faq/`
- `data/knowledge/circulars/`
- `data/knowledge/laws/`

سپس سرور را یک‌بار ری‌استارت کنید (کش دانش در حافظه است).

## مسیرهای بعدی پیشنهادی

1. جایگزینی جستجوی واژگانی با embedding + vector DB (مثلاً pgvector)
2. اتصال به LLM سازمانی (on-prem / API داخلی) با citation اجباری
3. اتصال به سامانه تیکتینگ موجود (مثلاً دیده‌بان / AiTicket)
4. SSO سازمانی و نقش کارشناس/ادمین
5. آپلود و ایندکس خودکار PDF بخشنامه‌ها

## ساختار

```
BehzistiSupportBot/
  data/knowledge/     دانش نمونه
  src/app/            صفحات و API
  src/components/     چت‌ویجت و پنل کارشناس
  src/lib/            RAG، دانش، ذخیره جلسات
  public/             لوگو
```
