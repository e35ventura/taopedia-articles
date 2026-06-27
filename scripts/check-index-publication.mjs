import assert from "node:assert";
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { collectArticlePaths, isPublishedArticle } from "./lib/article-discovery.mjs";

const root = process.cwd();
const pagesDir = path.join(root, "content/pages");
const indexPath = path.join(root, "content/index/articles.jsonl");

const expectedSlugs = [];
for (const { articlePath, slug } of await collectArticlePaths(pagesDir)) {
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
