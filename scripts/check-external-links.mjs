import { promises as fs } from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import matter from "gray-matter";

const ROOT = process.cwd();
const PAGES_DIR = path.join(ROOT, "content/pages");
const TIMEOUT_MS = 10_000;
const CONCURRENCY = 8;

const urlPattern = /\[[^\]]*\]\((https?:\/\/[^)]+)\)/g;

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(fp);
    else if (entry.isFile() && entry.name === "index.mdx") yield fp;
  }
}

function extractUrls(content) {
  return [...content.matchAll(urlPattern)].map((m) => m[1]);
}

function slugFromPath(fp) {
  const parts = fp.split(path.sep);
  const idx = parts.indexOf("pages");
  return idx >= 0 ? parts[idx + 1] : fp;
}

function checkUrl(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith("https") ? https : http;
    let req;
    try {
      req = mod.request(url, { method: "HEAD", timeout: TIMEOUT_MS }, (res) => {
        res.resume();
        resolve({ ok: res.statusCode < 400, status: res.statusCode });
      });
      req.on("error", (e) => resolve({ ok: false, status: null, error: e.message }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false, status: null, error: "timeout" });
      });
      req.end();
    } catch (e) {
      resolve({ ok: false, status: null, error: e.message });
    }
  });
}

async function runPool(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < tasks.length) {
        const i = next++;
        results[i] = await tasks[i]();
      }
    })
  );
  return results;
}

async function main() {
  const urlsBySlug = new Map();
  const allUrls = new Set();

  for await (const fp of walk(PAGES_DIR)) {
    const raw = await fs.readFile(fp, "utf8");
    const { data, content } = matter(raw);
    if (data.draft) continue;
    const urls = extractUrls(content);
    if (urls.length) {
      const slug = slugFromPath(fp);
      urlsBySlug.set(slug, urls);
      for (const u of urls) allUrls.add(u);
    }
  }

  const uniqueUrls = [...allUrls];
  console.log(`Checking ${uniqueUrls.length} unique URLs from ${urlsBySlug.size} articles...`);

  const cache = new Map();
  const tasks = uniqueUrls.map((url) => async () => {
    process.stdout.write(".");
    const result = await checkUrl(url);
    cache.set(url, result);
  });

  await runPool(tasks, CONCURRENCY);
  console.log("\n");

  let broken = 0;
  for (const [slug, urls] of [...urlsBySlug].sort(([a], [b]) => a.localeCompare(b))) {
    for (const url of urls) {
      const r = cache.get(url);
      if (!r.ok) {
        const detail = r.status ? `HTTP ${r.status}` : (r.error ?? "unknown");
        console.log(`BROKEN  [${slug}]  ${url}  (${detail})`);
        broken++;
      }
    }
  }

  if (broken === 0) {
    console.log(`All ${uniqueUrls.length} external links OK.`);
  } else {
    console.error(`\n${broken} broken link(s) found.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
