export type NavItem = {
  id: string;
  label: string;
  href: string;
  purpose: string;
};

export const navigation: NavItem[] = [
  {
    id: "overview",
    label: "نمای کلان مدیریتی",
    href: "/",
    purpose: "وضعیت کلی و اولویت‌های مدیریتی",
  },
  {
    id: "demand",
    label: "تحلیل تقاضا",
    href: "/demand",
    purpose: "حجم، ترکیب و تغییرات درخواست‌ها",
  },
  {
    id: "resolution",
    label: "عملکرد رسیدگی",
    href: "/resolution",
    purpose: "سرعت و وضعیت فرایند رسیدگی",
  },
  {
    id: "backlog",
    label: "وضعیت پرونده‌های باز",
    href: "/backlog",
    purpose: "انباشت، تأخیر و فشار کاری",
  },
  {
    id: "critical",
    label: "تحلیل موضوعات بحرانی",
    href: "/critical",
    purpose: "مسائل مهم و ریشه‌یابی",
  },
  {
    id: "provinces",
    label: "تحلیل استانی",
    href: "/provinces",
    purpose: "مقایسه مناطق و استان‌ها",
  },
  {
    id: "quality",
    label: "کیفیت داده و تعاریف",
    href: "/quality",
    purpose: "اعتمادپذیری شاخص‌ها",
  },
];
