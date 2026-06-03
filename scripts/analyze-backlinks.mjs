import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const ROOT = process.cwd();
const PAGES_DIR = path.join(ROOT, "content/pages");
const OUT_PATH = path.join(ROOT, "content/index/backlinks.json");

const wikiLinkPattern = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

function slugifyWikiLink(value) {
  return value
    .toLowerCase()
    .replace(/ /g, "_")
    .replace(/[^\w-]/g, "");
}

async function main() {
  const entries = await fs.readdir(PAGES_DIR, { withFileTypes: true });

  // Pass 1: collect slugs, titles, and title->slug map
  const articles = new Map(); // slug -> { title, category }
  const titleToSlug = new Map();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fp = path.join(PAGES_DIR, entry.name, "index.mdx");
    try {
      const raw = await fs.readFile(fp, "utf8");
      const { data } = matter(raw);
      if (data.draft) continue;
      articles.set(entry.name, {
        title: typeof data.title === "string" ? data.title.trim() : entry.name,
        category: typeof data.category === "string" ? data.category.trim() : "",
      });
      if (typeof data.title === "string" && data.title.trim()) {
        titleToSlug.set(slugifyWikiLink(data.title.trim()), entry.name);
      }
    } catch {
      // Skip folders without index.mdx
    }
  }

  // Pass 2: build link graph
  const inbound = new Map(); // slug -> Set of slugs that link TO it
  const outbound = new Map(); // slug -> Set of slugs it links TO
  for (const slug of articles.keys()) {
    inbound.set(slug, new Set());
    outbound.set(slug, new Set());
  }

  for (const slug of articles.keys()) {
    const fp = path.join(PAGES_DIR, slug, "index.mdx");
    const raw = await fs.readFile(fp, "utf8");
    const { content } = matter(raw);
    const links = [...content.matchAll(wikiLinkPattern)].map((m) => m[1].trim());
    for (const link of links) {
      const normalized = slugifyWikiLink(link);
      const targetSlug = titleToSlug.get(normalized) ?? normalized;
      if (articles.has(targetSlug) && targetSlug !== slug) {
        outbound.get(slug).add(targetSlug);
        inbound.get(targetSlug).add(slug);
      }
    }
  }

  // Sort by inbound count descending
  const ranked = [...articles.keys()].sort(
    (a, b) => inbound.get(b).size - inbound.get(a).size
  );

  // Top 20 hubs
  console.log("\n=== Top 20 Most-Linked Articles ===");
  for (const slug of ranked.slice(0, 20)) {
    const n = inbound.get(slug).size;
    if (n === 0) break;
    console.log(`  ${String(n).padStart(3)}  ${slug}`);
  }

  // Articles with zero inbound links
  const noInbound = ranked.filter((s) => inbound.get(s).size === 0);
  const fullyOrphaned = noInbound.filter((s) => outbound.get(s).size === 0);
  const deadEnds = noInbound.filter((s) => outbound.get(s).size > 0);

  console.log(`\n=== Fully Orphaned (no inbound, no outbound links): ${fullyOrphaned.length} ===`);
  for (const slug of fullyOrphaned) {
    console.log(`  ${slug}`);
  }

  console.log(`\n=== No Inbound Links (but has outbound): ${deadEnds.length} ===`);
  for (const slug of deadEnds) {
    console.log(`  (${String(outbound.get(slug).size).padStart(2)} out)  ${slug}`);
  }

  console.log(`\nTotal articles: ${articles.size}`);

  // Write full JSON report
  const report = {};
  for (const [slug, info] of articles) {
    report[slug] = {
      title: info.title,
      category: info.category,
      inboundCount: inbound.get(slug).size,
      outboundCount: outbound.get(slug).size,
      inbound: [...inbound.get(slug)].sort(),
      outbound: [...outbound.get(slug)].sort(),
    };
  }

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nFull report written to content/index/backlinks.json`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
