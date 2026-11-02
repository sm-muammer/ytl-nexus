import type { MetadataRoute } from "next";

// Keeps workspace routes and APIs out of search results (Requirement 3.9).
// /control is deliberately absent: a Disallow line would reveal that the hidden
// administration area exists. Control relies on its noindex metadata and, from
// Task 6, on answering non-administrators with the same 404 as any unknown path.
const WORKSPACE_PATHS = [
  "/command",
  "/ai",
  "/transfer",
  "/mail",
  "/data",
  "/continuity",
  "/shield",
  "/design",
  "/api/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: WORKSPACE_PATHS },
  };
}
