import type { Role } from "@/lib/roles";

// ---- The role matrix of docs/product.md section 3, written out by hand ----------------

export const PAGE_MATRIX: Record<string, Role | null> = {
  "/": null,
  "/platform": null,
  "/story": null,
  "/tour": null,
  "/yes": null,
  "/status": null,
  "/library": null,
  "/signin": null,
  "/design": "viewer",
  "/account": "viewer",
  "/command": "viewer",
  "/command/core-01": "viewer",
  "/command/atlas": "viewer",
  "/command/metrics": "viewer",
  "/command/services": "viewer",
  "/data": "viewer",
  "/ai": "member",
  "/transfer": "member",
  "/mail": "member",
  "/studio": "operator",
  "/continuity": "operator",
  "/shield": "operator",
};
