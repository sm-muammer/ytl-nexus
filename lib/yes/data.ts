export type YesPlan = {
  id: string;
  title: string;
  price: string;
  period: string;
  features: string[];
  popular?: boolean;
  officialUrl: string;
};

export const YES_PLANS: readonly YesPlan[] = [
  {
    id: "infinite-basic",
    title: "Yes 5G Infinite Basic",
    price: "RM58",
    period: "/month",
    features: [
      "Uncapped 5G & 4G Full Speed Data",
      "Unlimited Calls to all local networks",
      "20GB Hotspot Data included",
      "Nationwide 5G DNB Infrastructure Coverage",
      "No Contract / Flexible Termination",
    ],
    popular: false,
    officialUrl: "https://www.yes.my/postpaid/",
  },
  {
    id: "infinite-standard",
    title: "Yes 5G Infinite Standard",
    price: "RM88",
    period: "/month",
    features: [
      "Uncapped 5G & 4G Full Speed Data",
      "Unlimited Calls to all local networks",
      "50GB Hotspot Data included",
      "Nationwide 5G DNB Infrastructure Coverage",
      "Free 5G Roaming in Singapore (Selected Partner)",
      "Priority VIP Customer Care",
    ],
    popular: true,
    officialUrl: "https://www.yes.my/postpaid/",
  },
  {
    id: "infinite-premium",
    title: "Yes 5G Infinite Premium",
    price: "RM118",
    period: "/month",
    features: [
      "Uncapped 5G & 4G Ultra-Speed Data",
      "Unlimited Calls to all local networks",
      "80GB Hotspot Data included",
      "Nationwide 5G Coverage & Free eSIM Activation",
      "Complimentary International Roaming pack",
      "Device Upgrade Bundle Eligibility",
    ],
    popular: false,
    officialUrl: "https://www.yes.my/postpaid/",
  },
];

export type YesFaq = {
  question: string;
  answer: string;
};

export const YES_FAQS: readonly YesFaq[] = [
  {
    question: "How do I check my 5G coverage?",
    answer:
      "You can check our interactive coverage checker on the Coverage page or verify on the official Yes portal (yes.my/coverage) for live Digital Nasional Berhad (DNB) network reach across Malaysia.",
  },
  {
    question: "What devices are compatible with Yes 5G?",
    answer:
      "Most modern 5G-certified devices in Malaysia from Apple, Samsung, Honor, Xiaomi, Vivo, and Oppo support Yes 5G out of the box with VoLTE and VoNR capabilities.",
  },
  {
    question: "How do I switch or port in to Yes 5G?",
    answer:
      "You can port in (MNP) your existing mobile number easily via the MyYes App or visit any Yes Store or authorized distributor nationwide without changing your phone number.",
  },
  {
    question: "Are there speed caps or FUP on Infinite plans?",
    answer:
      "Yes Infinite mobile plans offer uncapped 4G/5G data for personal on-device smartphone usage subject to our standard Fair Usage Policy.",
  },
];
