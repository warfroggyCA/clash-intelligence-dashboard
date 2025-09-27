import Link from "next/link";
import FAQSections from "@/components/FAQSections";

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative isolate px-6 pb-24 pt-16 sm:px-10 lg:px-16">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-x-0 top-[-10rem] mx-auto h-[32rem] max-w-4xl bg-gradient-to-br from-brand-primary/20 via-brand-surfaceRaised/10 to-transparent blur-3xl" />
          <div className="absolute bottom-[-12rem] right-[-6rem] h-[28rem] w-[28rem] rounded-full bg-brand-primary/10 blur-3xl" />
        </div>

        <header className="mx-auto flex max-w-5xl flex-col gap-6 text-center">
          <div className="mx-auto flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
            <span className="text-brand-primary">FAQ</span>
            <span>Clash Intelligence Dashboard</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            Everything leaders need to run the ACE dashboard with confidence
          </h1>
          <p className="text-sm text-slate-300 sm:text-base">
            We collected the questions clan leadership teams ask most often—covering data sources, ACE scoring, operations, and troubleshooting. Bookmark this hub and share it with co-leads.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs uppercase tracking-[0.24em] text-slate-400">
            <Link href="/" className="rounded-full border border-white/10 px-4 py-2 transition hover:border-brand-primary/60 hover:text-slate-100">
              ← Back to dashboard
            </Link>
            <Link href="/docs/architecture/data-spine" className="rounded-full border border-white/10 px-4 py-2 transition hover:border-brand-primary/60 hover:text-slate-100">
              Data spine docs
            </Link>
          </div>
        </header>

        <div className="mx-auto mt-14 max-w-5xl">
          <FAQSections className="space-y-10" />
        </div>
      </div>
    </main>
  );
}
