"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const SUGGESTIONS = [
  "وضعیت پرونده‌های باز چگونه است؟",
  "کدام موضوعات بیشترین تغییر را داشته‌اند؟",
  "مقایسه استانی را نشان بده",
  "کیفیت داده در چه وضعیتی است؟",
];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "سلام. دستیار داشبورد مدیریتی دیدبان هستم. سؤال مدیریتی بپرسید؛ در صورت تنظیم کلید مدل، با داده زنده داشبورد پاسخ می‌دهم.",
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, busy]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", text: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history
            .filter((m) => m.id !== "welcome" || m.role === "user")
            .map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = (await res.json()) as { reply?: string };
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: data.reply?.trim() || "پاسخی دریافت نشد. لطفاً دوباره تلاش کنید.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: "ارتباط با سرویس گفتگو برقرار نشد. اتصال شبکه یا تنظیمات کلید را بررسی کنید.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50">
      <div
        className={`pointer-events-auto absolute bottom-0 right-0 origin-bottom-right transition-[opacity,transform] duration-200 ease-out ${
          open
            ? "visible translate-y-0 scale-100 opacity-100"
            : "invisible pointer-events-none translate-y-2 scale-95 opacity-0"
        }`}
      >
        <div className="flex h-[min(32rem,70vh)] w-[min(24rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.18)]">
          <header className="flex items-center justify-between bg-[#00BAD1] px-4 py-3 text-white">
            <div>
              <div className="text-sm font-semibold">دستیار مدیریتی دیدبان</div>
              <div className="text-[11px] text-white/85">پاسخ بر اساس شاخص‌ها و داده زنده</div>
            </div>
            <button
              type="button"
              aria-label="بستن گفتگو"
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 hover:bg-white/15"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-[13px] leading-6 ${
                  m.role === "user"
                    ? "mr-auto bg-[#00BAD1] text-white"
                    : "ml-auto bg-white text-slate-800 shadow-sm ring-1 ring-slate-100"
                }`}
              >
                {m.text}
              </div>
            ))}
            {busy ? (
              <div className="ml-auto inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[12px] text-slate-500 shadow-sm ring-1 ring-slate-100">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                در حال تحلیل…
              </div>
            ) : null}
            {messages.length < 3 && !busy ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-full border border-[#00BAD1]/40 bg-white px-3 py-1 text-[11px] text-[#008a9a] hover:bg-[#00BAD1]/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="سؤال مدیریتی خود را بنویسید…"
              disabled={busy}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#00BAD1] focus:ring-2 focus:ring-[#00BAD1]/20 disabled:opacity-60"
            />
            <button
              type="submit"
              aria-label="ارسال"
              disabled={busy}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#00BAD1] text-white hover:bg-[#00a7bb] disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      <button
        type="button"
        aria-label="باز کردن گفتگو"
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
        onClick={() => setOpen(true)}
        className={`pointer-events-auto relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#00BAD1] text-white shadow-[0_8px_24px_rgba(0,186,209,0.45)] transition-[opacity,transform,visibility] duration-200 hover:scale-105 hover:bg-[#00a7bb] lg:h-16 lg:w-16 ${
          open ? "invisible pointer-events-none scale-90 opacity-0" : "visible scale-100 opacity-100"
        }`}
      >
        <span className="animate-slowPing absolute -right-1 -top-1 z-0 h-12 w-12 rounded-full bg-[#00BAD140] lg:h-16 lg:w-16" />
        <span className="animate-slowPing absolute -right-1 -top-1 z-0 h-12 w-12 rounded-full bg-[#00BAD140] opacity-70 [animation-delay:0.8s] lg:h-16 lg:w-16" />
        <span className="relative z-10">
          <MessageCircle className="h-6 w-6" />
        </span>
      </button>
    </div>
  );
}
