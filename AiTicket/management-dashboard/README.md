# داشبورد مدیریتی دیدبان (پورت 3001)

داشبورد جدا برای مدیران ارشد سازمان بهزیستی، مطابق سند طراحی مدیریتی.

## اجرا

```bash
# API (همان AiTicket.Api روی 5088)
cd ../api/AiTicket.Api
dotnet run

# این داشبورد
cd ../management-dashboard
npm.cmd install
npm.cmd run dev
```

باز کنید: [http://localhost:3001](http://localhost:3001)

هفت صفحه منو: نمای کلان، تقاضا، رسیدگی، پرونده‌های باز، موضوعات بحرانی، استانی، کیفیت داده.

API مرتبط: `GET /api/v1/management/{overview|demand|resolution|backlog|provinces|quality|critical}`

### دستیار گفتگو (LLM)

کلید را فقط در `management-dashboard/.env.local` بگذارید (نه در فرانت):

```env
LLM_API_KEY=...
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.3-70b-versatile
```

مسیر پروکسی: `POST /api/chat` — کلید روی سرور می‌ماند و context زنده overview را به مدل می‌دهد.

گزینه‌های رایگان/ارزان رایج: Groq، Gemini (با endpoint سازگار)، OpenRouter مدل‌های free. ChatGPT رسمی معمولاً اعتبار پولی می‌خواهد.

داشبورد تحلیلی قبلی روی پورت 3000 باقی می‌ماند.
