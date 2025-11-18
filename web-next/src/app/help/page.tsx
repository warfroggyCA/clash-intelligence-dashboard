import Link from "next/link";
import UserFAQSections from "@/components/UserFAQSections";

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative isolate px-6 pb-24 pt-16 sm:px-10 lg:px-16">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-x-0 top-[-10rem] mx-auto h-[28rem] max-w-4xl bg-gradient-to-br from-brand-primary/10 via-brand-surfaceRaised/5 to-transparent blur-3xl" />
          <div className="absolute bottom-[-12rem] left-[-6rem] h-[24rem] w-[24rem] rounded-full bg-brand-primary/10 blur-3xl" />
        </div>

        <header className="mx-auto flex max-w-4xl flex-col gap-6 text-center">
          <div className="mx-auto flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
            <span className="text-brand-primary">Members</span>
            <span>Clash Intelligence Help Center</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            Everything you need to navigate the HeckYeah dashboard
          </h1>
          <p className="text-sm text-slate-300 sm:text-base">
            Learn how to sign in, link your player tags, see your stats, and keep your minis private. Share this page
            with anyone who just got invited so they feel comfortable on day one.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs uppercase tracking-[0.24em] text-slate-400">
            <Link href="/login" className="rounded-full border border-white/10 px-4 py-2 transition hover:border-brand-primary/60 hover:text-slate-100">
              Go to login
            </Link>
            <Link href="/faq" className="rounded-full border border-white/10 px-4 py-2 transition hover:border-brand-primary/60 hover:text-slate-100">
              Leadership FAQ
            </Link>
          </div>
        </header>

        <div className="mx-auto mt-14 max-w-4xl">
          <UserFAQSections className="space-y-10" />
        </div>
      </div>
    </main>
  );
}
