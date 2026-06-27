import { promises as fs } from "node:fs";
import path from "node:path";

export async function* walkArticleFiles(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkArticleFiles(fp);
    else if (entry.isFile() && entry.name === "index.mdx") yield fp;
  }
}

export function slugFromArticlePath(fp) {
  const parts = fp.split(path.sep);
  const idx = parts.indexOf("pages");
  return idx >= 0 ? parts[idx + 1] : null;
}

export function isPublishedArticle(slug, data) {
  if (data?.draft === true) return false;
  if (slug === "taopedia") return false;
  return true;
}

export async function collectArticlePaths(pagesDir) {
  const paths = [];
  for await (const articlePath of walkArticleFiles(pagesDir)) {
    const slug = slugFromArticlePath(articlePath);
    if (slug) paths.push({ articlePath, slug, articleDir: path.dirname(articlePath) });
  }
  return paths;
}
