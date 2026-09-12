import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SignInButton from "@/components/SignInButton";

// This page checks the session on every request (to redirect signed-in users
// to /chat), so it can't be statically prerendered.
export const dynamic = "force-dynamic";

const USE_CASES = [
  {
    title: "Track a technology",
    body: "Where does hydrogen fuel cell adoption actually stand, and who's shipping real hardware versus running pilots?",
  },
  {
    title: "Follow a policy",
    body: "What does the EU's Green Deal Industrial Plan actually commit to, in the sponsor's own words and the coverage of it?",
  },
  {
    title: "Compare approaches",
    body: "How do utility-financed geothermal projects differ from developer-owned ones, and which is scaling faster?",
  },
];

export default async function LandingPage() {
  const session = await auth();
  if (session) redirect("/chat");

  return (
    <div className="min-h-screen">
      <header className="bg-petrol px-6 py-5 text-paper">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <BrandMark />
          <span className="font-display text-lg">CleanTech Desk</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {/* Hero */}
        <section className="grid gap-10 py-16 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-24">
          <div>
            <h1 className="font-display text-4xl leading-[1.1] text-ink lg:text-5xl">
              Ask clean technology questions. Get answers traced to where
              they came from.
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              CleanTech Desk is a research assistant built on 20,000+ cleantech
              and climate news articles. Every answer is retrieved from that
              archive first, then written with inline citations back to the
              specific pieces it drew from — so you can verify it, not just
              trust it.
            </p>
            <div className="mt-8">
              <SignInButton />
            </div>
          </div>

          <ExamplePreview />
        </section>

        {/* How it works */}
        <section className="border-t border-paper-line py-16">
          <h2 className="font-display text-2xl text-ink">How it works</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            <Step n={1} title="Sign in">
              One click with your Google account — no separate password to
              create.
            </Step>
            <Step n={2} title="Ask">
              Type a question about solar, wind, batteries, EVs, hydrogen,
              carbon capture, or climate policy, in plain language.
            </Step>
            <Step n={3} title="Verify">
              Read the answer, then check the sources rail for the exact
              articles behind each claim — click through to the originals
              anytime.
            </Step>
          </ol>
        </section>

        {/* What it's for */}
        <section className="border-t border-paper-line py-16">
          <h2 className="font-display text-2xl text-ink">What it's good for</h2>
          <p className="mt-3 max-w-2xl text-[15px] text-muted">
            Built for the kind of question where you'd normally have to skim
            a dozen articles yourself — comparing technologies, tracking a
            policy, or getting oriented on a topic before digging deeper.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {USE_CASES.map((u) => (
              <div key={u.title} className="border-l-2 border-paper-line pl-4">
                <h3 className="font-display text-lg text-ink">{u.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{u.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-paper-line py-16 text-center">
          <p className="font-display text-xl text-ink">
            Your past conversations are saved to your account.
          </p>
          <p className="mt-2 text-sm text-muted">
            Come back anytime and pick up where you left off.
          </p>
          <div className="mt-6 flex justify-center">
            <SignInButton />
          </div>
        </section>
      </main>

      <footer className="border-t border-paper-line px-6 py-8 text-center text-xs text-muted">
        CleanTech Desk — a research project grounded in the CleanTech Media dataset.
      </footer>
    </div>
  );
}

function BrandMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden="true" className="text-paper">
      <path d="M13 24c0-7-4-9-8-11 6 0 8 3 8 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13 24c0-9 5-12 10-14-7 0-10 4-10 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="list-none">
      <span className="font-display text-3xl text-amber">{n}</span>
      <h3 className="mt-2 font-display text-lg text-ink">{title}</h3>
      <p className="mt-1.5 text-sm text-muted">{children}</p>
    </li>
  );
}

function ExamplePreview() {
  return (
    <div className="rounded-sm border border-paper-line bg-white/40 p-5">
      <p className="text-xs text-muted">You asked</p>
      <p className="mt-1 font-display text-[17px] text-ink">
        What are the four focus areas of the EU&apos;s Green Deal Industrial Plan?
      </p>
      <div className="mt-4 border-t border-paper-line pt-4 text-[14px] leading-relaxed text-ink">
        The plan centers on four pillars: regulatory environment
        <sup className="mx-0.5 rounded-sm bg-amber-dim px-1 py-0.5 text-[0.7em] font-medium text-petrol">1</sup>,
        access to finance
        <sup className="mx-0.5 rounded-sm bg-amber-dim px-1 py-0.5 text-[0.7em] font-medium text-petrol">1</sup>,
        enhancing skills
        <sup className="mx-0.5 rounded-sm bg-amber-dim px-1 py-0.5 text-[0.7em] font-medium text-petrol">2</sup>,
        and supply chain resilience
        <sup className="mx-0.5 rounded-sm bg-amber-dim px-1 py-0.5 text-[0.7em] font-medium text-petrol">2</sup>.
      </div>
      <p className="mt-4 text-xs text-muted">2 sources cited →</p>
    </div>
  );
}
