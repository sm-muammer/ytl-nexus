// Deterministic demo statuses for the eight server adapters (DEMO-02). Pure
// data: the same call always returns the same value, and nothing here opens a
// connection. Every consumer shows these values with a "Demo data" label.
// Module task fixtures (metrics, incidents, records) are added by the task that
// builds the module.

import type { AdapterName } from "@/lib/server/adapters/types";

export type DemoStatusFixture = {
  state: "ok" | "warn";
  label: string;
  detail: string;
};

export const adapterStatusFixtures: Record<AdapterName, DemoStatusFixture> = {
  db: {
    state: "ok",
    label: "Healthy",
    detail: "Sample MariaDB records served from fixtures.",
  },
  auth: {
    state: "ok",
    label: "Healthy",
    detail: "Sessions come from the demo session switcher.",
  },
  wordpress: {
    state: "ok",
    label: "Healthy",
    detail: "Sample Library and Story content served from fixtures.",
  },
  prometheus: {
    state: "ok",
    label: "Healthy",
    detail: "Sample metrics for Nexus Core 01 served from fixtures.",
  },
  ollama: {
    state: "ok",
    label: "Healthy",
    detail: "Scripted sample answers; no model is running.",
  },
  sftpgo: {
    state: "ok",
    label: "Healthy",
    detail: "Sample file-transfer accounts served from fixtures.",
  },
  ops: {
    state: "ok",
    label: "Healthy",
    detail: "Sample service list; no server action can run in demo mode.",
  },
  mail: {
    state: "warn",
    label: "Degraded",
    detail: "Sample mail queue with one deferred message.",
  },
};
