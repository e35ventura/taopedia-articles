import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const pagesDir = path.join(root, "content/pages");

// Mirror build-index.mjs discovery: every index.mdx the indexer can reach must
// be validated, including ones nested below the top-level article directory.
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
const markdownHttpLinkPattern = /!?\[[^\]]+\]\(https?:\/\/[^)]+\)/gi;
const fencedCodeBlockPattern = /^[ \t]*(```|~~~)/m;
const markdownImagePattern = /!\[[^\]]*\]\(([^)]+)\)/g;

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
    if (tag.toLowerCase() === "bittensor") {
      throw new Error(
        `${filePath}: do not use "Bittensor" as a tag; every Taopedia article is already Bittensor-focused`
      );
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

function extractWikiLinksFromValue(value) {
  if (typeof value === "string") return extractWikiLinks(value);
  if (Array.isArray(value)) return value.flatMap((item) => extractWikiLinksFromValue(item));
  if (value && typeof value === "object") {
    return Object.values(value).flatMap((item) => extractWikiLinksFromValue(item));
  }
  return [];
}

function isPublishedArticle(slug, data) {
  if (data?.draft === true) return false;
  return slug !== "taopedia";
}

function hasFencedCodeBlock(content) {
  return fencedCodeBlockPattern.test(content);
}

function hasSourceLink(content) {
  for (const match of content.matchAll(markdownHttpLinkPattern)) {
    if (!match[0].startsWith("!")) return true;
  }
  return false;
}

// Resolve the local file path of a Markdown image target, or null when the
// target is remote (has a URI scheme or is protocol-relative), empty, or a
// pure fragment. Mirrors how the published site would load a local asset.
function localImageTarget(rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith("<") && target.endsWith(">")) {
    target = target.slice(1, -1).trim();
  } else {
    // Drop an optional Markdown title: ![alt](path "title").
    target = target.split(/\s+/)[0];
  }
  if (!target) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//")) return null;
  const pathPart = target.split("#")[0].split("?")[0];
  if (!pathPart) return null;
  try {
    return decodeURIComponent(pathPart);
  } catch {
    return pathPart;
  }
}

// Markdown image syntax shown inside code (e.g. a tutorial example) is not a real
// asset reference, so ignore fenced code blocks and inline code spans before scanning.
function stripMarkdownCode(content) {
  return content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/~~~[\s\S]*?~~~/g, "")
    .replace(/`[^`\n]*`/g, "");
}

// Resolve a local asset target relative to the article directory and require it
// to be a file that stays inside that directory. Shared by the body image-
// reference check and the infoboxImage front matter check.
async function ensureLocalAssetFile(articlePath, articleDir, relativeTarget, label) {
  const articleRoot = path.resolve(articleDir);
  const resolved = path.resolve(articleDir, relativeTarget);
  if (resolved !== articleRoot && !resolved.startsWith(articleRoot + path.sep)) {
    throw new Error(
      `${articlePath}: ${label} "${relativeTarget}" must stay inside the article directory`
    );
  }
  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch {
    throw new Error(
      `${articlePath}: ${label} "${relativeTarget}" does not resolve to a local asset`
    );
  }
  if (!stat.isFile()) {
    throw new Error(`${articlePath}: ${label} "${relativeTarget}" is not a file`);
  }
}

async function validateImageReferences(articlePath, articleDir, content) {
  for (const match of stripMarkdownCode(content).matchAll(markdownImagePattern)) {
    const relativeTarget = localImageTarget(match[1]);
    if (relativeTarget === null) continue;
    await ensureLocalAssetFile(articlePath, articleDir, relativeTarget, "image reference");
  }
}

// infoboxImage may be a remote URL or a local path that the published site loads
// as an article asset (the same way body images are loaded). Body image
// references are resolution-checked above; apply the same check to a local
// infoboxImage so a broken local path is caught here instead of failing to load
// on the rendered card. Remote URLs (localImageTarget returns null) are left alone.
async function validateInfoboxImage(articlePath, articleDir, data) {
  if (typeof data.infoboxImage !== "string") return;
  const relativeTarget = localImageTarget(data.infoboxImage);
  if (relativeTarget === null) return;
  await ensureLocalAssetFile(articlePath, articleDir, relativeTarget, "infoboxImage");
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
  if (data.category?.trim().toLowerCase() === "bittensor") {
    throw new Error(
      `${articlePath}: do not use "Bittensor" as a category; every Taopedia article is already Bittensor-focused`
    );
  }
  validateTags(data, articlePath);
  for (const target of [...extractWikiLinks(content), ...extractWikiLinksFromValue(data)]) {
    const normalizedTarget = slugifyWikiLink(target);
    if (!knownTargets.has(normalizedTarget)) {
      throw new Error(
        `${articlePath}: internal link "[[${target}]]" does not resolve to an article`
      );
    }
  }
  await validateImageReferences(articlePath, articleDir, content);
  await validateInfoboxImage(articlePath, articleDir, data);
  if (isPublishedArticle(slug, data) && !hasSourceLink(content)) {
    throw new Error(`${articlePath}: published articles must include at least one source link`);
  }
  if (isPublishedArticle(slug, data) && hasFencedCodeBlock(content)) {
    throw new Error(
      `${articlePath}: published articles must not contain fenced code blocks; explain commands and configuration in prose`
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
  const articles = [];
  const knownTargets = new Set();

  for await (const articlePath of walk(pagesDir)) {
    const slug = slugFromPath(articlePath);
    if (!slug) continue;
    const articleDir = path.dirname(articlePath);

    try {
      const raw = await fs.readFile(articlePath, "utf8");
      const { data } = matter(raw);
      articles.push({ slug, articleDir, articlePath, published: isPublishedArticle(slug, data) });
      knownTargets.add(slug);
      if (typeof data.title === "string" && data.title.trim()) {
        knownTargets.add(slugifyWikiLink(data.title.trim()));
      }
    } catch {
      // Skip folders without article content.
    }
  }

  // Every published article must map to a unique published slug. build-index.mjs walks
  // index.mdx files recursively but derives each slug from the top-level content/pages/<slug>
  // directory, so two articles nested under the same top-level directory would emit two index
  // records for one slug, producing duplicate Taopedia routes and ambiguous [[wiki link]]
  // resolution. Reject that collision here, where npm run validate already runs in CI.
  const publishedSlugSources = new Map();
  for (const { slug, articlePath, published } of articles) {
    if (!published) continue;
    const previous = publishedSlugSources.get(slug);
    if (previous) {
      const [first, second] = [previous, articlePath].map((p) => path.relative(root, p)).sort();
      throw new Error(
        `Duplicate published article slug "${slug}": "${first}" and "${second}" both resolve to the same Taopedia slug. Each published article must live at content/pages/<slug>/index.mdx with a unique <slug>.`
      );
    }
    publishedSlugSources.set(slug, articlePath);
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
