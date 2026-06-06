import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const ROOT = process.cwd();
const PAGES_DIR = path.join(ROOT, "content/pages");
const OUT_DIR = path.join(ROOT, "content/index");
const OUT_JSONL = path.join(OUT_DIR, "articles.jsonl");

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(fp);
    else if (entry.isFile() && entry.name === "index.mdx") yield fp;
  }
}

function slugFromPath(fp) {
  const parts = fp.split(path.sep);
  const idx = parts.indexOf("pages");
  return idx >= 0 ? parts[idx + 1] : null;
}

function normalizeString(s) {
  return typeof s === "string" ? s.trim() : "";
}

function isPublishedArticle(slug, data) {
  if (data?.draft === true) return false;
  if (slug === "taopedia") return false;
  return true;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const out = await fs.open(OUT_JSONL, "w");

  for await (const fp of walk(PAGES_DIR)) {
    const slug = slugFromPath(fp);
    if (!slug) continue;

    const raw = await fs.readFile(fp, "utf8");
    const { data } = matter(raw);
    if (!isPublishedArticle(slug, data)) continue;

    const title = normalizeString(data?.title) || slug;
    const summary = normalizeString(data?.summary) || "";
    const category = normalizeString(data?.category) || null;
    const tags = Array.isArray(data?.tags) ? data.tags.map(normalizeString).filter(Boolean) : [];

    const record = { slug, title, summary, category, tags };
    await out.appendFile(JSON.stringify(record) + "\n");
  }

  await out.close();

  // Optional: categories.json (uncomment to enable)
  // const cats = {};
  // const text = await fs.readFile(OUT_JSONL, 'utf8');
  // for (const line of text.split('\n')) {
  //   if (!line.trim()) continue;
  //   const { category } = JSON.parse(line);
  //   if (!category) continue;
  //   cats[category] = (cats[category] || 0) + 1;
  // }
  // await fs.writeFile(path.join(OUT_DIR, 'categories.json'), JSON.stringify(cats, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
