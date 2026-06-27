import assert from "node:assert";
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const pagesDir = path.join(root, "content/pages");
const indexPath = path.join(root, "content/index/articles.jsonl");

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

function isPublishedArticle(slug, data) {
  if (data?.draft === true) return false;
  if (slug === "taopedia") return false;
  return true;
}

const expectedSlugs = [];
for await (const articlePath of walk(pagesDir)) {
  const slug = slugFromPath(articlePath);
  if (!slug) continue;
  try {
    const raw = await fs.readFile(articlePath, "utf8");
    const { data } = matter(raw);
    if (isPublishedArticle(slug, data)) expectedSlugs.push(slug);
  } catch {
    // Skip folders without article content.
  }
}

const records = (await fs.readFile(indexPath, "utf8"))
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const indexedSlugs = records.map((record) => record.slug).sort();

assert.deepStrictEqual(
  indexedSlugs,
  expectedSlugs.sort(),
  "article index must contain exactly the pages that publish to Taopedia"
);

console.log("Article index publication rule check passed");
