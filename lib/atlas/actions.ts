import {
  HEALTH_CHECK_LABEL,
  OPS_UNIT_LABEL,
  type HealthCheckId,
  type OpsUnit,
} from "@/lib/ops/units";
import { meetsRole, type Actor } from "@/lib/roles";

// Which Task 9 actions apply to which Atlas service, and who may use them
// (ATL-03). This is presentation: the Server Functions in
// lib/server/ops-actions.ts check the role again and the agent keeps the real
// allowlist. A service with no entry has no predefined action.

type ServiceOps = { unit?: OpsUnit; check?: HealthCheckId };

export const SERVICE_OPS: Readonly<Record<string, ServiceOps>> = {
  "nexus-web": { unit: "nexus-web", check: "web" },
  mariadb: { check: "database" },
  prometheus: { unit: "prometheus", check: "prometheus" },
  ollama: { check: "ollama" },
  sftpgo: { unit: "sftpgo", check: "sftpgo" },
  postfix: { check: "mail" },
};

export type AtlasAction = {
  kind: "health" | "logs" | "restart";
  label: string;
  /** The unit or check the action is sent for. */
  target: string;
};

export type AtlasActionSet = {
  actions: AtlasAction[];
  /** Plain reason when `actions` is empty or cannot be used. */
  note: string | null;
  /** False in a demo session: shown, never run. */
  enabled: boolean;
};

export function allowedActions(
  slug: string,
  actor: Actor,
  demo: boolean,
): AtlasActionSet {
  if (!meetsRole(actor, "operator")) {
    return {
      actions: [],
      note: "Actions need the Operator role.",
      enabled: false,
    };
  }
  const ops = SERVICE_OPS[slug];
  const actions: AtlasAction[] = [];
  if (ops?.check) {
    actions.push({
      kind: "health",
      label: `Run health check: ${HEALTH_CHECK_LABEL[ops.check]}`,
      target: ops.check,
    });
  }
  if (ops?.unit) {
    actions.push(
      {
        kind: "logs",
        label: `Read log of ${OPS_UNIT_LABEL[ops.unit]}`,
        target: ops.unit,
      },
      {
        kind: "restart",
        label: `Restart ${OPS_UNIT_LABEL[ops.unit]}`,
        target: ops.unit,
      },
    );
  }
  if (actions.length === 0) {
    return {
      actions,
      note: "No predefined action exists for this service.",
      enabled: false,
    };
  }
  return {
    actions,
    note: demo ? "Demo session: actions are shown but nothing is run." : null,
    enabled: !demo,
  };
}
