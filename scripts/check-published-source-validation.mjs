import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptPath = path.join(path.dirname(__filename), "validate-content.mjs");
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "taopedia-source-validation-"));
const pagesDir = path.join(fixtureRoot, "content", "pages");

async function writeArticle(slug, tags, body, draft = false) {
  const articleDir = path.join(pagesDir, slug);
  await fs.mkdir(articleDir, { recursive: true });
  const draftField = draft ? "draft: true\n" : "";
  await fs.writeFile(
    path.join(articleDir, "index.mdx"),
    `---\n${draftField}title: ${slug}\nsummary: Test article.\ncategory: Testing\ntags: ${tags}\n---\n\n${body}\n`
  );
}

await writeArticle(
  "sourced_article",
  '["Testing"]',
  "This claim has a [source](https://docs.bittensor.com/).\n"
);
await writeArticle(
  "draft_article",
  '["Science"]',
  "Draft pages can exist without sources.\n",
  true
);

execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "inherit" });

await writeArticle(
  "image_only_article",
  '["Testing"]',
  "This published article has only an external image.\n\n![diagram](https://example.com/a.png)\n"
);

assert.throws(
  () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" }),
  /published articles must include at least one source link/,
  "validator must not count Markdown images as source links"
);

await fs.rm(path.join(pagesDir, "image_only_article"), { recursive: true, force: true });
await writeArticle(
  "unsourced_article",
  '["Testing"]',
  "This published article has no source link.\n"
);

assert.throws(
  () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" }),
  /published articles must include at least one source link/,
  "validator must reject published articles without source links"
);

await fs.rm(fixtureRoot, { recursive: true, force: true });
console.log("Published source validation check passed");
