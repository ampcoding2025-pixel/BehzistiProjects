# Didban → دانش چت‌بات + تست با مدل‌های رایگان (RAG)

## واقعیت داده‌ای (زنده از API — 2026-11-17)

| شاخص | مقدار |
|------|--------|
| پرونده واجد شرایط | ~۱۹۳٬۵۷۱ |
| پوشش پاسخ شهروند (`CookieFlowReplyCitizen`) | **~۶٫۴٪** (~۱۲٬۳۲۲ پرونده) |
| جدول `FAQ` دیده‌بان | فقط **۵ ردیف** — برای KB کافی نیست |
| اعتبار قانونی پاسخ تاریخی | در DB **وجود ندارد** (`available_unvalidated`) |

منبع پاسخ تاریخی مفید: `Cookie` (سؤال) + `CookieFlow.CookieFlowReplyCitizen` (پاسخ) + تاکسونومی `Subject`.

---

## ۱) Didban را چطور دانش کنیم؟

### لایه A — امن و سریع (همین الان)

| منبع | کاربرد |
|------|--------|
| `Subject` / `SubjectGroup` / `SubjectNature` | موضوعات پرتکرار کاربران |
| `CookieStatus` (توضیح شهروند) | معنی وضعیت پرونده |
| `FlowNode` متن SOP | راهنمای فرایند |
| FAQ تهیه‌شده از موضوعات پرتکرار | تست چت‌بات بدون PII |

### لایه B — RAG روی پاسخ‌های تاریخی (تست / آفلاین)

1. **خواندن فقط‌خواندنی** از طریق AiTicket API (ترجیح) نه مستقیم UI:
   - `GET /api/v1/knowledge/answers/summary`
   - `GET /api/v1/knowledge/answers/cases`
2. یا job شبانه read-only SQL:
   - `CookieCaption` / `CookieText` + آخرین `CookieFlowReplyCitizen` غیرخالی
   - join به `SubjectName`, `SubjectClassName`, `DepartmentName`
3. **PII scrub** قبل از ایندکس: کد ملی، موبایل، نام کامل (همان الگوی `Redact` در API)
4. Embed + ذخیره در vector store محلی (تست)
5. Retrieval → فقط chunkهای مرتبط + citation (`Subject`, caseId داخلی)
6. اگر score پایین → abstain / ارجاع کارشناس زنده

### لایه C — بعداً (تولید)

- نسخه/اعتبار بخشنامه روی پاسخ‌ها
- تأیید خبره (HITL) قبل از انتشار به شهروند
- جدا کردن دانش «عملیاتی داشبورد» از «پاسخ به مددجو»

---

## ۲) مدل‌های رایگان برای تست

| نقش | گزینه رایگان پیشنهادی | نکته |
|-----|------------------------|------|
| Embedding (RAG) | `sentence-transformers` چندزبانه یا مدل فارسی HF (مثلاً persian/multilingual MiniLM) | آفلاین، بدون کلید |
| LLM پاسخ | OpenRouter free / Groq free tier / Ollama محلی (مثلاً Llama / Qwen) | فقط روی context بازیابی‌شده |
| بدون GPU | lexical/BM25 فعلی ویجت + LLM سبک | همین پروژه الان lexical دارد |

الگوی prompt تست:

```
فقط از روی اسناد زیر پاسخ بده. اگر کافی نیست بگو نمی‌دانم و پیشنهاد کارشناس بده.
اسناد:
{retrieved_chunks}
سؤال کاربر:
{question}
```

**قانون:** عدد/وضعیت پرونده را از SQL/API بگیر؛ LLM فقط جمله‌بندی کند. پاسخ تاریخی = کاندید، نه قانون قطعی.

---

## ۳) مسیر تست عملی با همین ریپوها

```
Didban (RO) → AiTicket.Api:5088 → BehzistiSupportBot:3040 (RAG) → ویجت روی AiTicket:3000/3001
```

1. API دیده‌بان روشن: `AiTicket/api` روی `5088`
2. چت‌بات: `BehzistiSupportBot` روی `3040`
3. داشبورد + ویجت: `3000` / `3001`
4. دانش تست: فایل‌های `data/knowledge/faq/*.json` (از جمله `didban-frequent-faq.json`)
5. مرحله بعد: اسکریپت sync از `/api/v1/knowledge/answers/cases` → JSON/vector (با scrub)

Env پیشنهادی چت‌بات (بعد از اتصال LLM):

```
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=openrouter/free
LLM_API_KEY=...
SUPPORT_EMBEDDING=local-minilm
DIDBAN_KNOWLEDGE_API=http://localhost:5088
```

---

## ۴) موضوعات پرتکرار واقعی (از Didban)

از `frequentAnswers` / topics API:

1. حق پرستاری و مددکاری معلولیت شدید / خیلی شدید (~۱۷۲۰ پاسخ / حجم بالا)
2. عدم رعایت بخشنامه‌ها و دستورالعمل‌ها — توانبخشی
3. کمک موردی توانبخشی
4. کمک‌هزینه مسکن خرید و ساخت
5. کمک معیشتی
6. نحوه محاسبه صورتحساب مراکز مشاوره و روانشناسی
7. برقراری مستمری توانبخشی
8. کمک‌هزینه درمان توانبخشی
9. افزایش مبلغ / زمان واریز مستمری توانبخشی
10. وام اشتغال توانبخشی
11. استخدام افراد دارای معلولیت
12. ویلچر / لوازم توانبخشی

این‌ها پایه FAQ تست در `data/knowledge/faq/didban-frequent-faq.json` هستند.
