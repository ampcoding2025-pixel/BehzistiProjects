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

### GitHub Copilot

The app can use the Microsoft Copilot SDK as its chat provider. It runs inside
the app's Node.js process; a separate Copilot CLI install is only needed for
interactive sign-in.

1. Make sure the Windows account running the app has an eligible GitHub Copilot subscription.
2. Install the Copilot CLI if it is not already available:

   ```powershell
   npm.cmd install --global @github/copilot
   ```

3. Sign in as the same Windows account that runs the app:

   ```powershell
   copilot login
   ```

4. Open **Settings** in the app, select **GitHub Copilot**, and confirm its
   status is **Connected**.

Provider selection is shared by the app and stored in
`data/runtime/ai-provider.json`. Connection status is checked by the server.
The Copilot SDK session is limited to responding to the question and retrieved
knowledge; it is not given shell or filesystem tools. If the selected provider
is disconnected, chat requests report an error rather than silently switching
to another model.

### Ollama سریع

```powershell
# نصب از https://ollama.com/download سپس:
ollama pull llama3.2
# در .env.local: OLLAMA_MODEL=llama3.2
npm.cmd run dev -- -p 3040
# وضعیت: http://localhost:3040/api/ollama
```

### اتصال دانش دیده‌بان

The **Knowledge → Database connection** tab connects to the read-only AiTicket API,
not directly to SQL Server. Configure its private base URL in `.env.local`:

```env
DIDBAN_KNOWLEDGE_API=http://localhost:5088
```

Add the Dideban connection, test it, then enable it to sync all available
answered cases. The sync stores answer excerpts and topic metadata locally; it
does not copy case captions or expose SQL credentials, which stay on the
AiTicket API server. Disabling the connection removes it from chat retrieval.
Historical answers are marked unvalidated and receive a low-confidence handoff.
The source API redacts national codes and phone numbers; this app also removes
email addresses, but personal names in answer text may still require review.
Review network access and the existing Copilot data-sharing notice before using
historical case content with a cloud model.

## معماری فعلی (MVP)

| بخش | توضیح |
|------|--------|
| UI | Next.js + React، فارسی/RTL، برند بهزیستی |
| بازیابی دانش | جستجوی واژگانی روی فایل‌های JSON و پرونده‌های همگام‌شده دیده‌بان |
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
