# یکپارچه‌سازی ویجت گفتگو در اپ‌های دیگر

کامپوننت `SupportChatWidget` یک چت شناور RTL است که به لایه AI / دانش سازمانی وصل می‌شود و با `appId` پاسخ را به دانش همان برنامه محدود می‌کند.

## اتصال زنده به داشبورد AiTicket

چت‌بات در `BehzistiSupportBot` توسعه داده می‌شود؛ ویجت در داشبوردها نصب شده است:

| اپ | آدرس | appId |
|----|------|-------|
| BehzistiSupportBot (AI layer) | http://localhost:3040 | — |
| AiTicket web | http://localhost:3000 | `aiticket-web` |
| AiTicket management-dashboard | http://localhost:3001 | `aiticket-management` |

ویجت گوشه **پایین-راست** است و به `NEXT_PUBLIC_SUPPORT_BOT_URL` وصل می‌شود.

```bash
# ترمینال ۱ — لایه دانش / چت‌بات
cd BehzistiSupportBot && npm.cmd run dev -- -p 3040

# ترمینال ۲ — داشبورد تحلیلی
cd AiTicket/web && npm.cmd run dev

# ترمینال ۳ — داشبورد مدیریتی
cd AiTicket/management-dashboard && npm.cmd run dev
```

## استفاده در React / Next.js

```tsx
import { SupportChatWidget } from "@/components/support-chat";

export function AppShell() {
  return (
    <>
      {/* ... اپ شما ... */}
      <SupportChatWidget
        apiBaseUrl="http://localhost:3040"
        appId="aiticket-web"
        title="سامانه هوشمند پاسخگویی و پشتیبانی سازمانی"
        subtitle="پاسخ بر اساس دانش مرتبط"
        primaryColor="#00BAD1"
        position="bottom-right"
        userLabel="کاربر پنل"
        headers={{ Authorization: "Bearer ..." }} // اختیاری
        onHandoff={(sessionId) => console.log("handoff", sessionId)}
      />
    </>
  );
}
```

فایل‌های لازم برای کپی به اپ دیگر:

| فایل | نقش |
|------|-----|
| `src/widget/SupportChatWidget.tsx` | UI شناور + پنل |
| `src/widget/support-chat-widget.css` | استایل، `#00BAD1`، `customPing` |
| `src/widget/ai-client.ts` | کلاینت لایه AI |
| `src/widget/types.ts` | تایپ‌ها |
| `src/widget/index.ts` | export |

CSS ویجت را یک‌بار import کنید (داخل خود کامپوننت هم import شده است).

## پارامترهای مهم

| prop | توضیح |
|------|--------|
| `apiBaseUrl` | آدرس سرویس AI (همین پروژه یا لایه مدل سازمانی) |
| `appId` | دامنه دانش: `paydisk`، `aiticket`، `behzisti-portal`، ... |
| `primaryColor` | پیش‌فرض `#00BAD1` |
| `position` | `bottom-left` یا `bottom-right` |

## دامنه دانش (`appId`)

در فایل‌های `data/knowledge/**/*.json` فیلد اختیاری:

```json
"appIds": ["paydisk", "behzisti-portal"]
```

- `["*"]` یا بدون فیلد → برای همه اپ‌ها
- لیست مشخص → فقط همان اپ‌ها در بازیابی دانش دیده می‌شوند

## API لایه AI

- `POST /api/chat` — `{ message, sessionId?, appId, userLabel? }`
- `GET /api/chat?sessionId=...`
- `POST /api/handoff` — `{ action: "request"|"claim"|"reply"|"close", sessionId, ... }`

هدر اختیاری: `X-App-Id`

CORS برای فراخوانی از origin دیگر باز است (`*`) — در production محدودش کنید.

## ظاهر دکمه (مطابق اپ سازمانی)

- رنگ پینگ: `#00BAD140`
- انیمیشن: `customPing` / slow ping حدود ۲.۵ ثانیه
- فونت: IranYekan / Tahoma، `direction: rtl`
