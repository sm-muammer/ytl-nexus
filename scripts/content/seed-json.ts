// Writes infrastructure/wordpress/seed-content.json from the demo fixtures, so
// Studio starts with the same platform overview, runbooks and FAQs (LIB-09).
// Run: npm run content:seed-json
import { writeFileSync } from "node:fs";
import path from "node:path";
import { contentFixtures } from "../../lib/fixtures/content.ts";

const out = path.resolve(
  import.meta.dirname,
  "../../infrastructure/wordpress/seed-content.json",
);

const items = contentFixtures.map((i) => ({
  type: i.type,
  slug: i.slug,
  title: i.title,
  content: i.html,
  excerpt: i.excerpt,
  audience: i.audience,
  related_service: i.relatedService ?? "",
  business_unit: i.businessUnit ?? "",
  source_url: i.sourceUrl ?? "",
  menu_order: i.order,
}));

writeFileSync(out, JSON.stringify(items, null, 2) + "\n");
console.log(
  `Wrote ${items.length} items to ${path.relative(process.cwd(), out)}`,
);
