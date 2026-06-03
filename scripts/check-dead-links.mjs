import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const pagesDir = path.join(root, "content/pages");

const CONCURRENCY = 5;
const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_500;
const USER_AGENT = "Taopedia-LinkChecker/1.0 (https://taopedia.org)";

const mdLinkPattern = /\[(?:[^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;

function extractUrls(content) {
  const urls = new Set();
  for (const match of content.matchAll(mdLinkPattern)) {
    try {
      urls.add(new URL(match[1].trim()).href);
    } catch {
      // ignore malformed URLs
    }
  }
  return urls;
}

async function fetchWithTimeout(url, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT },
    });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function checkUrl(url, retries = MAX_RETRIES) {
  try {
    const result = await fetchWithTimeout(url, "HEAD");
    // Some servers block HEAD — fall back to GET
    if (result.status === 405) return fetchWithTimeout(url, "GET");
    return result;
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return checkUrl(url, retries - 1);
    }
    const message = err.name === "AbortError" ? "timeout" : err.message;
    return { ok: false, status: null, error: message };
  }
}

async function runWithConcurrency(urls, concurrency) {
  const results = new Map();
  const queue = [...urls];
  let idx = 0;

  async function worker() {
    while (idx < queue.length) {
      const url = queue[idx++];
      results.set(url, await checkUrl(url));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function main() {
  const entries = await fs.readdir(pagesDir, { withFileTypes: true });

  const articleUrls = new Map();
  const allUrls = new Set();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const articlePath = path.join(pagesDir, entry.name, "index.mdx");
    let raw;
    try {
      raw = await fs.readFile(articlePath, "utf8");
    } catch {
      continue;
    }
    const { data, content } = matter(raw);
    if (data?.draft === true) continue;

    const urls = extractUrls(content);
    if (urls.size === 0) continue;
    articleUrls.set(entry.name, urls);
    for (const u of urls) allUrls.add(u);
  }

  const total = allUrls.size;
  console.log(`Checking ${total} unique URL(s) across ${articleUrls.size} article(s)...`);

  const results = await runWithConcurrency(allUrls, CONCURRENCY);

  let deadCount = 0;
  for (const [slug, urls] of [...articleUrls].sort()) {
    const dead = [];
    for (const url of urls) {
      const r = results.get(url);
      if (r && !r.ok) dead.push({ url, ...r });
    }
    if (dead.length === 0) continue;
    console.log(`\n${slug}:`);
    for (const { url, status, error } of dead) {
      const detail = status != null ? `HTTP ${status}` : `error: ${error}`;
      console.log(`  [${detail}] ${url}`);
      deadCount++;
    }
  }

  if (deadCount === 0) {
    console.log("All links OK.");
  } else {
    console.log(`\n${deadCount} dead link(s) found.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
