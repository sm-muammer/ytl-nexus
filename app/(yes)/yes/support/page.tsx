import { pageMetadata } from "@/components/layout/module-page";
import { YES_FAQS } from "@/lib/yes/data";
import { FaqAccordion } from "@/components/yes/faq-accordion";
import { SupportForm } from "@/components/yes/support-form";

export const metadata = pageMetadata("/yes/support");

export default function YesSupportPage() {
  return (
    <div className="space-y-20 py-8">
      {/* Header */}
      <section className="px-(--spacing-gutter) text-center">
        <div className="mx-auto max-w-2xl space-y-4">
          <h1 className="text-ink text-3xl font-extrabold tracking-tight sm:text-5xl">
            Customer{" "}
            <span className="from-yes-pink to-yes-gradient-end bg-gradient-to-r bg-clip-text text-transparent">
              Help & Support
            </span>
          </h1>
          <p className="text-muted text-base leading-relaxed">
            Frequently asked questions, self-service information, and our
            interactive support contact form.
          </p>
        </div>
      </section>

      {/* FAQs */}
      <section className="px-(--spacing-gutter)">
        <div className="max-w-page mx-auto">
          <h2 className="text-ink mb-8 text-center text-2xl font-bold">
            Frequently Asked Questions
          </h2>
          <FaqAccordion items={YES_FAQS} />
        </div>
      </section>

      {/* Support Form */}
      <section className="px-(--spacing-gutter)">
        <div className="max-w-page mx-auto">
          <div className="mb-8 text-center">
            <h2 className="text-ink text-2xl font-bold">
              Send a Support Message
            </h2>
            <p className="text-muted mt-1 text-xs">
              Have feedback or questions? Submit your details below.
            </p>
          </div>
          <SupportForm />
        </div>
      </section>
    </div>
  );
}
