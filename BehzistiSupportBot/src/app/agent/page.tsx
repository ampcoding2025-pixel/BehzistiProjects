import { AgentConsole } from "@/components/AgentConsole";

export default function AgentPage() {
  return (
    <>
      <section className="hero">
        <h2>پنل کارشناس زنده</h2>
        <p>
          گفتگوهایی که ربات نتوانسته پاسخ مطمئن بدهد، یا کاربر درخواست کارشناس کرده، اینجا در صف قرار
          می‌گیرند. گفتگو را بپذیرید و پاسخ دهید.
        </p>
      </section>
      <AgentConsole />
    </>
  );
}
