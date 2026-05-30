import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptPath = path.join(path.dirname(__filename), "validate-content.mjs");
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "taopedia-source-validation-"));
const pagesDir = path.join(fixtureRoot, "content", "pages");

async function writeArticle(slug, tags, body) {
  const articleDir = path.join(pagesDir, slug);
  await fs.mkdir(articleDir, { recursive: true });
  await fs.writeFile(
    path.join(articleDir, "index.mdx"),
    `---\ntitle: ${slug}\nsummary: Test article.\ncategory: Testing\ntags: ${tags}\n---\n\n${body}\n`
  );
}

await writeArticle(
  "sourced_bittensor",
  '["Bittensor"]',
  "This claim has a [source](https://docs.bittensor.com/).\n"
);
await writeArticle(
  "sample_article",
  '["Science"]',
  "Sample pages can exist without Bittensor sources.\n"
);

execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "inherit" });

await writeArticle(
  "unsourced_bittensor",
  '["Bittensor"]',
  "This published article has no source link.\n"
);

assert.throws(
  () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" }),
  /published Bittensor articles must include at least one source link/,
  "validator must reject published Bittensor articles without source links"
);

await fs.rm(fixtureRoot, { recursive: true, force: true });
console.log("Published source validation check passed");
