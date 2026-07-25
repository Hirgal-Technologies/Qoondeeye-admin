"use client";

import { ArrowRight, BarChart3, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";

export function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await response
      .json()
      .catch(() => ({ error: "invalid response" }));

    setSubmitting(false);
    if (!response.ok || body.error) {
      setError(
        body.error === "forbidden"
          ? "This account does not have dashboard access."
          : "The email or password is incorrect."
      );
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="relative grid min-h-screen bg-transparent lg:grid-cols-[minmax(0,1fr)_minmax(460px,0.72fr)]">
      <div className="absolute right-3 top-3 z-10">
        <ThemeToggle />
      </div>

      <section className="brand-panel relative hidden overflow-hidden border-r p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-md border border-primary-foreground/20 bg-primary-foreground text-sm font-bold text-primary">
            Q
          </span>
          <div>
            <p className="text-sm font-semibold">Qoondeeye</p>
            <p className="text-[10px] uppercase tracking-[0.18em] opacity-60">Admin analytics</p>
          </div>
        </div>

        <div className="max-w-xl">
          <span className="mb-6 grid size-10 place-items-center rounded-md border border-primary-foreground/20">
            <BarChart3 aria-hidden="true" className="size-5" />
          </span>
          <h1 className="max-w-lg text-4xl font-semibold leading-[1.12] tracking-[-0.04em] xl:text-5xl">
            Clear decisions, grounded in trustworthy data.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-primary-foreground/65">
            Monitor growth, financial activity, and platform health from one secure,
            privacy-conscious workspace.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-primary-foreground/60">
          <ShieldCheck aria-hidden="true" className="size-4" />
          Aggregate analytics · Role-aware access · Audited actions
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-16 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <span className="brand-gradient grid size-9 place-items-center rounded-md text-sm font-bold text-primary-foreground">
              Q
            </span>
            <div>
              <p className="text-sm font-semibold">Qoondeeye</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Admin analytics
              </p>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Authorized team members
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Sign in with your Qoondeeye admin account to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block text-xs font-medium">Email address</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/15"
                placeholder="name@qoondeeye.com"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-medium">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/15"
                placeholder="Enter your password"
              />
            </label>

            {error ? (
              <div
                className="flex items-start gap-2 rounded-md border border-destructive/35 bg-destructive/5 p-3 text-xs text-destructive"
                role="alert"
                aria-live="polite"
              >
                <LockKeyhole aria-hidden="true" className="mt-px size-4 shrink-0" />
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="gradient-button inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-55"
            >
              {submitting ? "Signing in…" : "Sign in securely"}
              {!submitting ? <ArrowRight aria-hidden="true" className="size-4" /> : null}
            </button>
          </form>

          <div className="mt-8 flex items-start gap-2 border-t pt-5 text-[11px] leading-5 text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            Access is limited to approved Qoondeeye staff. Sign-in and sensitive actions may be
            recorded for security review.
          </div>
        </div>
      </section>
    </main>
  );
}
