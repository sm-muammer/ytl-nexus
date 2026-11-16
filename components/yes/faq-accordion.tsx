"use client";

import { useState } from "react";
import type { YesFaq } from "@/lib/yes/data";

export function FaqAccordion({ items }: { items: readonly YesFaq[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="divide-line mx-auto max-w-2xl divide-y">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={idx} className="py-4">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              aria-expanded={isOpen}
              className="text-ink focus-ring flex w-full items-center justify-between text-left text-base font-semibold"
            >
              <span>{item.question}</span>
              <svg
                aria-hidden="true"
                className={`text-muted h-5 w-5 shrink-0 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {isOpen && (
              <p className="text-muted mt-3 text-sm leading-relaxed">
                {item.answer}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
