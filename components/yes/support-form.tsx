"use client";

import { useState } from "react";
import { supportSchema, type SupportInput } from "@/lib/yes/validation";

export function SupportForm() {
  const [formData, setFormData] = useState<SupportInput>({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof SupportInput, string>>
  >({});
  const [submitted, setSubmitted] = useState<SupportInput | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = supportSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof SupportInput, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof SupportInput;
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      setSubmitted(null);
      return;
    }

    setErrors({});
    setSubmitted(result.data);
  };

  return (
    <div className="border-line bg-surface/90 mx-auto max-w-xl rounded-2xl border p-6 shadow-sm">
      {submitted ? (
        <div className="space-y-4" role="status">
          <div className="flex items-center gap-2">
            <span className="bg-status-success h-3.5 w-3.5 rounded-full" />
            <h4 className="text-ink font-semibold">
              Inquiry Drafted Successfully (Concept Demo)
            </h4>
          </div>
          <p className="text-muted text-sm leading-relaxed">
            Thank you, <strong className="text-ink">{submitted.name}</strong>.
            Your inquiry concerning &quot;{submitted.subject}&quot; was
            validated and captured in this concept environment.
          </p>
          <div className="border-line bg-surface-elevated rounded-xl border p-4 text-xs">
            <p className="text-muted font-medium">
              Honest Confirmation Notice:
            </p>
            <p className="text-muted mt-1">
              Because this is the Yes Experience concept environment, this form
              does not dispatch tickets to Yes customer support agents. For
              urgent billing or active SIM issues, please contact the official
              Yes care team at{" "}
              <a
                href="https://www.yes.my/support/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yes-pink underline"
              >
                yes.my/support ↗
              </a>{" "}
              or call 018-333 0000.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSubmitted(null);
              setFormData({ name: "", email: "", subject: "", message: "" });
            }}
            className="focus-ring border-line text-muted hover:text-ink hover:bg-surface-elevated inline-flex items-center justify-center rounded-xl border px-4 py-2 text-xs font-medium"
          >
            Send Another Inquiry
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="support-name"
              className="text-ink block text-sm font-semibold"
            >
              Full Name
            </label>
            <input
              id="support-name"
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              placeholder="Your name"
              className="border-line bg-surface text-ink placeholder:text-muted focus-ring mt-1 w-full rounded-xl border px-3.5 py-2 text-sm outline-none"
            />
            {errors.name && (
              <p className="text-status-danger mt-1 text-xs" role="alert">
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="support-email"
              className="text-ink block text-sm font-semibold"
            >
              Email Address
            </label>
            <input
              id="support-email"
              type="email"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              placeholder="you@example.com"
              className="border-line bg-surface text-ink placeholder:text-muted focus-ring mt-1 w-full rounded-xl border px-3.5 py-2 text-sm outline-none"
            />
            {errors.email && (
              <p className="text-status-danger mt-1 text-xs" role="alert">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="support-subject"
              className="text-ink block text-sm font-semibold"
            >
              Subject
            </label>
            <input
              id="support-subject"
              type="text"
              value={formData.subject}
              onChange={(e) => {
                setFormData({ ...formData, subject: e.target.value });
                if (errors.subject)
                  setErrors({ ...errors, subject: undefined });
              }}
              placeholder="Inquiry topic"
              className="border-line bg-surface text-ink placeholder:text-muted focus-ring mt-1 w-full rounded-xl border px-3.5 py-2 text-sm outline-none"
            />
            {errors.subject && (
              <p className="text-status-danger mt-1 text-xs" role="alert">
                {errors.subject}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="support-message"
              className="text-ink block text-sm font-semibold"
            >
              Message Details
            </label>
            <textarea
              id="support-message"
              rows={4}
              value={formData.message}
              onChange={(e) => {
                setFormData({ ...formData, message: e.target.value });
                if (errors.message)
                  setErrors({ ...errors, message: undefined });
              }}
              placeholder="Please describe your question or feedback..."
              className="border-line bg-surface text-ink placeholder:text-muted focus-ring mt-1 w-full rounded-xl border px-3.5 py-2 text-sm outline-none"
            />
            {errors.message && (
              <p className="text-status-danger mt-1 text-xs" role="alert">
                {errors.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="focus-ring bg-yes-pink text-surface inline-flex w-full items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold shadow-xs transition-transform active:scale-95"
          >
            Submit Support Inquiry
          </button>
        </form>
      )}
    </div>
  );
}
