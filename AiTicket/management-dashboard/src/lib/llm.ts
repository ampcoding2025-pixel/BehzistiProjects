type ChatRole = "user" | "assistant" | "system";

const SYSTEM_PROMPT = `شما دستیار مدیریتی داشبورد دیدبان برای مدیران ارشد سازمان بهزیستی هستید.
زبان پاسخ: فارسی، رسمی، کوتاه و قابل استفاده در جلسه مدیریتی.

قواعد:
- فقط درباره شاخص‌های داشبورد، پرونده‌ها، شکایات، رسیدگی، استان‌ها و کیفیت داده صحبت کنید.
- واقعیت آماری را از فرضیه جدا کنید؛ هم‌زمانی دو تغییر را علت قطعی ندانید.
- SLA رسمی تا تعریف مصوب قابل محاسبه نیست؛ تأخیر CookieFlow فقط شاخص جانشین است.
- خاتمه زمانی (FinishTime) را با خاتمه وضعیتی ادغام نکنید.
- اگر داده زنده در context آمده، از همان اعداد استفاده کنید و منبع/بازه را ذکر کنید.
- در پایان در صورت نیاز یک مسیر پیشنهادی بدهید (مثلاً صفحه پرونده‌های باز یا تحلیل استانی).
- اگر سؤال خارج از دامنه داشبورد بود، مؤدبانه رد کنید و به صفحات مرتبط پیشنهاد دهید.`;

export function localFallback(question: string): string {
  const q = question.trim();
  if (/باز|انباشت|تأخیر|تاخیر/.test(q)) {
    return "برای بررسی انباشت به صفحه «وضعیت پرونده‌های باز» بروید. تعریف موقت باز بر اساس نبود FinishTime است.";
  }
  if (/موضوع|تغییر|بحرانی|شکایت/.test(q)) {
    return "موضوعات پرتغییر در نمای کلان و «تحلیل موضوعات بحرانی» آمده‌اند. هم‌زمانی دو شاخص علت قطعی نیست.";
  }
  if (/استان|منطقه|جغراف/.test(q)) {
    return "از فیلتر استان یا صفحه «تحلیل استانی» برای مقایسه حجم و نرخ‌ها استفاده کنید.";
  }
  if (/کیفیت|تعریف|SLA|داده/.test(q)) {
    return "تعاریف و پوشش داده در صفحه «کیفیت داده و تعاریف» است. SLA رسمی فعلاً نمایش داده نمی‌شود.";
  }
  if (/خاتمه|رسیدگی|زمان/.test(q)) {
    return "شاخص‌های خاتمه زمانی و زمان رسیدگی در صفحه «عملکرد رسیدگی» هستند.";
  }
  return "سؤال را دقیق‌تر بپرسید یا از پیشنهادهای متداول داشبورد مدیریتی استفاده کنید.";
}

export async function fetchDashboardContext(): Promise<string> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5088";
  try {
    const res = await fetch(`${base}/api/v1/management/overview`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return "داده‌های زنده در دسترس نبود.";
    const data = (await res.json()) as {
      meta?: { periodLabel?: string };
      ruleSetVersion?: string;
      kpis?: { label: string; value: number | null; unit: string; deltaPercent?: number | null }[];
      topChangingTopics?: { name: string; count: number; deltaPercent: number | null }[];
      alerts?: { change: string; where: string; impact: string }[];
    };
    const kpiLines =
      data.kpis
        ?.slice(0, 8)
        .map((k) => `- ${k.label}: ${k.value ?? "—"} ${k.unit} (Δ ${k.deltaPercent ?? "—"}٪)`)
        .join("\n") ?? "";
    const topicLines =
      data.topChangingTopics
        ?.slice(0, 5)
        .map((t) => `- ${t.name}: n=${t.count}, Δ=${t.deltaPercent ?? "—"}٪`)
        .join("\n") ?? "";
    const alertLines =
      data.alerts
        ?.slice(0, 4)
        .map((a) => `- ${a.change} | ${a.where} | ${a.impact}`)
        .join("\n") ?? "";
    return [
      `بازه: ${data.meta?.periodLabel ?? "—"}`,
      `نسخه قواعد: ${data.ruleSetVersion ?? "—"}`,
      "KPIها:",
      kpiLines || "—",
      "موضوعات پرتغییر:",
      topicLines || "—",
      "هشدارها:",
      alertLines || "—",
    ].join("\n");
  } catch {
    return "اتصال به API مدیریتی برقرار نشد.";
  }
}

export async function askLlm(args: {
  history: { role: "user" | "assistant"; content: string }[];
  question: string;
}): Promise<{ reply: string; provider: string; model?: string; error?: string }> {
  const apiKey = process.env.LLM_API_KEY?.trim();
  const baseUrl = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    return { reply: localFallback(args.question), provider: "local-fallback" };
  }

  const context = await fetchDashboardContext();
  const payloadMessages: { role: ChatRole; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Context زنده داشبورد:\n${context}` },
    ...args.history.slice(-12),
  ];

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (baseUrl.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = process.env.LLM_HTTP_REFERER ?? "http://localhost:3001";
      headers["X-Title"] = process.env.LLM_APP_TITLE ?? "Didban Management Dashboard";
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: payloadMessages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        reply: localFallback(args.question),
        provider: "fallback-after-error",
        error: errText.slice(0, 400),
      };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return { reply: localFallback(args.question), provider: "fallback-empty" };
    }
    return { reply, provider: "llm", model };
  } catch (e: unknown) {
    return {
      reply: localFallback(args.question),
      provider: "fallback-network",
      error: e instanceof Error ? e.message : "network_error",
    };
  }
}
