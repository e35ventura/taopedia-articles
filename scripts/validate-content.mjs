import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const pagesDir = path.join(root, "content/pages");
const allowedAssetExtensions = new Set([
  ".avif",
  ".gif",
  ".jpg",
  ".jpeg",
  ".json",
  ".png",
  ".webp",
]);
const maxAssetBytes = 5 * 1024 * 1024;
const unsafeContentPatterns = [
  { pattern: /^\s*import\s/m, reason: "MDX imports are not allowed" },
  { pattern: /^\s*export\s/m, reason: "MDX exports are not allowed" },
  { pattern: /<\s*script[\s>]/i, reason: "script tags are not allowed" },
  { pattern: /<\s*\/\s*script\s*>/i, reason: "script tags are not allowed" },
  {
    pattern: /<\s*(iframe|object|embed|link|meta|style)\b/i,
    reason: "active HTML elements are not allowed",
  },
  { pattern: /\son[a-z]+\s*=/i, reason: "inline event handlers are not allowed" },
  { pattern: /\bjavascript\s*:/i, reason: "javascript: URLs are not allowed" },
  { pattern: /\bdata\s*:\s*text\/html/i, reason: "HTML data URLs are not allowed" },
  { pattern: /\bset:html\b/i, reason: "raw HTML injection directives are not allowed" },
  { pattern: /\bclient:[a-z-]+\b/i, reason: "client directives are not allowed" },
];
const wikiLinkPattern = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
const sourceLinkPattern = /\[[^\]]+\]\(https?:\/\/[^)]+\)/i;

function validateSlug(slug) {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
    throw new Error(
      `Unsafe article slug "${slug}". Use lowercase letters, numbers, underscores, and hyphens.`
    );
  }
}

function validateTextField(data, field, filePath, maxLength) {
  const value = data[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${filePath}: front matter field "${field}" is required`);
  }
  if (value.length > maxLength) {
    throw new Error(
      `${filePath}: front matter field "${field}" must be ${maxLength} characters or fewer`
    );
  }
}

function validateTags(data, filePath) {
  if (!Array.isArray(data.tags)) {
    throw new Error(`${filePath}: front matter field "tags" must be an array`);
  }
  if (data.tags.length > 3) {
    throw new Error(`${filePath}: use at most 3 tags`);
  }
  for (const tag of data.tags) {
    if (typeof tag !== "string" || !tag.trim()) {
      throw new Error(`${filePath}: tags must be non-empty strings`);
    }
    if (tag.length > 40) {
      throw new Error(`${filePath}: tags must be 40 characters or fewer`);
    }
  }
}

function slugifyWikiLink(value) {
  return value
    .toLowerCase()
    .replace(/ /g, "_")
    .replace(/[^\w-]/g, "");
}

function extractWikiLinks(content) {
  return [...content.matchAll(wikiLinkPattern)].map((match) => match[1].trim());
}

function isPublishedBittensorArticle(data) {
  if (data?.draft === true) return false;
  return Array.isArray(data?.tags) && data.tags.includes("Bittensor");
}

async function validateArticle(slug, articleDir, knownTargets) {
  validateSlug(slug);

  const articlePath = path.join(articleDir, "index.mdx");
  const raw = await fs.readFile(articlePath, "utf8");
  for (const { pattern, reason } of unsafeContentPatterns) {
    if (pattern.test(raw)) {
      throw new Error(`${articlePath}: ${reason}`);
    }
  }

  const { data, content } = matter(raw);
  validateTextField(data, "title", articlePath, 120);
  validateTextField(data, "summary", articlePath, 240);
  validateTextField(data, "category", articlePath, 60);
  validateTags(data, articlePath);
  for (const target of extractWikiLinks(content)) {
    const normalizedTarget = slugifyWikiLink(target);
    if (!knownTargets.has(normalizedTarget)) {
      throw new Error(
        `${articlePath}: internal link "[[${target}]]" does not resolve to an article`
      );
    }
  }
  if (isPublishedBittensorArticle(data) && !sourceLinkPattern.test(content)) {
    throw new Error(
      `${articlePath}: published Bittensor articles must include at least one source link`
    );
  }

  if (Array.isArray(data.infoboxRows)) {
    for (const row of data.infoboxRows) {
      if (typeof row?.label !== "string" || typeof row?.value !== "string") {
        throw new Error(`${articlePath}: infoboxRows must contain string label/value pairs`);
      }
    }
  }
}

async function validateAssets(articleDir) {
  const entries = await fs.readdir(articleDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(articleDir, entry.name);
    if (entry.isDirectory()) {
      await validateAssets(entryPath);
      continue;
    }
    if (!entry.isFile() || entry.name === "index.mdx") continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!allowedAssetExtensions.has(ext)) {
      throw new Error(
        `${entryPath}: unsupported asset type. Allowed: ${Array.from(allowedAssetExtensions).join(", ")}`
      );
    }

    const stat = await fs.stat(entryPath);
    if (stat.size > maxAssetBytes) {
      throw new Error(`${entryPath}: asset exceeds ${maxAssetBytes} bytes`);
    }
  }
}

async function main() {
  const entries = await fs.readdir(pagesDir, { withFileTypes: true });
  const articles = [];
  const knownTargets = new Set();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const articleDir = path.join(pagesDir, entry.name);
    const articlePath = path.join(articleDir, "index.mdx");

    try {
      const raw = await fs.readFile(articlePath, "utf8");
      const { data } = matter(raw);
      articles.push({ slug: entry.name, articleDir });
      knownTargets.add(entry.name);
      if (typeof data.title === "string" && data.title.trim()) {
        knownTargets.add(slugifyWikiLink(data.title.trim()));
      }
    } catch {
      // Skip folders without article content.
    }
  }

  let count = 0;

  for (const { slug, articleDir } of articles) {
    await validateArticle(slug, articleDir, knownTargets);
    await validateAssets(articleDir);
    count += 1;
  }

  console.log(`Validated ${count} articles`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
