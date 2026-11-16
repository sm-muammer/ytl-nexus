"use client";

import { useState } from "react";
import { newsletterSchema } from "@/lib/yes/validation";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = newsletterSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid email");
      return;
    }

    setError(null);
    setSubscribed(true);
  };

  return (
    <div className="border-line bg-surface/90 mx-auto max-w-md rounded-2xl border p-6 text-center shadow-xs">
      <h3 className="text-ink text-base font-semibold">Stay in the Loop</h3>
      <p className="text-muted mt-1 text-xs leading-relaxed">
        Receive curated updates on 5G device launches and network rollouts.
      </p>

      {subscribed ? (
        <div
          className="bg-surface-elevated border-line mt-4 rounded-xl border p-3 text-xs"
          role="status"
        >
          <p className="text-status-success font-medium">
            ✓ Email registered for demo previews!
          </p>
          <p className="text-muted mt-1">
            Note: This is a concept showcase. For official Yes promotional
            campaigns, visit{" "}
            <a
              href="https://www.yes.my/promotions/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yes-pink underline"
            >
              yes.my/promotions ↗
            </a>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter your email address"
              aria-label="Email address for updates"
              className="border-line bg-surface text-ink placeholder:text-muted focus-ring flex-1 rounded-xl border px-3.5 py-2 text-xs outline-none"
            />
            <button
              type="submit"
              className="focus-ring bg-yes-pink text-surface inline-flex items-center justify-center rounded-xl px-4 py-2 text-xs font-semibold shadow-xs transition-transform active:scale-95"
            >
              Subscribe
            </button>
          </div>
          {error && (
            <p
              className="text-status-danger mt-2 text-left text-xs"
              role="alert"
            >
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
