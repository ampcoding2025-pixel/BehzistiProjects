import { NextRequest, NextResponse } from "next/server";

const MANAGEMENT_FAQS = [
  {
    id: "mgmt-faq-open",
    title: "پرونده‌های باز",
    question: "وضعیت پرونده‌های باز و انباشت چگونه است؟",
    category: "backlog",
    tags: ["باز", "انباشت"],
  },
  {
    id: "mgmt-faq-topics",
    title: "موضوعات پرتغییر",
    question: "کدام موضوعات بیشترین تغییر معنادار را داشته‌اند؟",
    category: "critical",
    tags: ["موضوع", "تغییر"],
  },
  {
    id: "mgmt-faq-province",
    title: "تحلیل استانی",
    question: "کدام استان‌ها نیازمند توجه مدیریتی هستند؟",
    category: "provinces",
    tags: ["استان"],
  },
  {
    id: "mgmt-faq-resolution",
    title: "عملکرد رسیدگی",
    question: "میانه زمان رسیدگی و نرخ خاتمه در چه وضعیتی است؟",
    category: "resolution",
    tags: ["رسیدگی", "خاتمه"],
  },
  {
    id: "mgmt-faq-demand",
    title: "تحلیل تقاضا",
    question: "ترکیب شکایت و راهنمایی نسبت به دوره قبل چگونه تغییر کرده است؟",
    category: "demand",
    tags: ["تقاضا", "شکایت"],
  },
  {
    id: "mgmt-faq-quality",
    title: "کیفیت داده",
    question: "پوشش تاریخ خاتمه و محدودیت‌های SLA چگونه است؟",
    category: "quality",
    tags: ["کیفیت", "SLA"],
  },
  {
    id: "mgmt-faq-alerts",
    title: "هشدارها",
    question: "مهم‌ترین هشدارهای مدیریتی فعلی چیست؟",
    category: "overview",
    tags: ["هشدار"],
  },
  {
    id: "mgmt-faq-defs",
    title: "تعاریف",
    question: "تفاوت خاتمه زمانی و خاتمه وضعیتی چیست؟",
    category: "quality",
    tags: ["تعریف"],
  },
];

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "12");
  return NextResponse.json({
    faqs: MANAGEMENT_FAQS.slice(0, Number.isFinite(limit) ? limit : 12),
  });
}
