# اتصال Ollama به سامانه پاسخگویی

چت‌بات دانش را با RAG بازیابی می‌کند و پاسخ نهایی را با **Ollama** می‌سازد. اگر Ollama در دسترس نباشد، به پاسخ واژگانی (lexical) برمی‌گردد.

## نصب (ویندوز)

دانلود نصب‌کننده از سایت رسمی (اگر `winget` به GitHub دسترسی ندارد):

1. [https://ollama.com/download](https://ollama.com/download)
2. `OllamaSetup.exe` را نصب کنید
3. ترمینال جدید باز کنید و مدل بکشید:

```powershell
ollama pull llama3.2
# یا سبک‌تر:
ollama pull qwen2.5:3b
# یا فارسی‌محورتر در صورت تمایل:
ollama pull gemma2:2b
```

بررسی:

```powershell
ollama list
curl http://127.0.0.1:11434/api/tags
```

## تنظیمات پروژه

فایل `.env.local`:

```
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
OLLAMA_TIMEOUT_MS=90000
```

سپس سرور چت‌بات را ری‌استارت کنید:

```powershell
cd c:\Users\m.alipor\Projects\BehzistiSupportBot
npm.cmd run dev -- -p 3040
```

وضعیت:

- [http://localhost:3040/api/ollama](http://localhost:3040/api/ollama)

## جریان پاسخ

```
سؤال کاربر
  → بازیابی دانش (FAQ / بخشنامه / Didban FAQ)
  → Ollama (system prompt فارسی + اسناد)
  → اگر Ollama قطع بود → پاسخ lexical
  → اطمینان پایین → پیشنهاد کارشناس زنده
```

## نکات سازمانی

- Ollama کاملاً محلی است؛ داده به اینترنت نمی‌رود (مگر خود مدل از قبل دانلود شده باشد).
- برای اینترانت، مدل را یک‌بار روی ماشینی با اینترنت بکشید و فایل‌ها را منتقل کنید، یا mirror داخلی بگذارید.
- بعد از وصل شدن، ویجت AiTicket روی `3000`/`3001` همان API روی `3040` را صدا می‌زند.
