import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const pagesDir = path.join(root, "content/pages");
const indexPath = path.join(root, "content/index/articles.jsonl");

function isPublishedArticle(slug, data) {
  if (data?.draft === true) return false;
  if (slug === "taopedia") return false;
  return true;
}

const expectedSlugs = [];
for (const entry of await fs.readdir(pagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const articlePath = path.join(pagesDir, entry.name, "index.mdx");
  try {
    const raw = await fs.readFile(articlePath, "utf8");
    const { data } = matter(raw);
    if (isPublishedArticle(entry.name, data)) expectedSlugs.push(entry.name);
  } catch {
    // Skip folders without article content.
  }
}

const records = (await fs.readFile(indexPath, "utf8"))
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const indexedSlugs = records.map((record) => record.slug).sort();

assert.deepEqual(
  indexedSlugs,
  expectedSlugs.sort(),
  "article index must contain exactly the pages that publish to Taopedia"
);

console.log("Article index publication rule check passed");
