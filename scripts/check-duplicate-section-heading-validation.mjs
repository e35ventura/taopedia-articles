import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptPath = path.join(path.dirname(__filename), "validate-content.mjs");
const fixtureRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "taopedia-duplicate-heading-validation-")
);
const pagesDir = path.join(fixtureRoot, "content", "pages");

async function writeArticle(slug, body, draft = false) {
  const articleDir = path.join(pagesDir, slug);
  await fs.mkdir(articleDir, { recursive: true });
  const draftField = draft ? "draft: true\n" : "";
  await fs.writeFile(
    path.join(articleDir, "index.mdx"),
    `---\n${draftField}title: ${slug}\nsummary: Test article.\ncategory: Testing\ntags: []\n---\n\n${body}\n`
  );
}

await writeArticle(
  "unique_headings",
  "## First Section\n\nIntro text.\n\n## Second Section\n\nMore text.\n\nSource: [docs](https://docs.learnbittensor.com/).\n"
);
await writeArticle(
  "draft_duplicate",
  "## Repeated\n\nDraft notes.\n\n## Repeated\n\nMore draft notes.\n",
  true
);

execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "inherit" });

await writeArticle(
  "duplicate_headings",
  "## Shared Title\n\nFirst use.\n\n## Shared Title\n\nSecond use.\n\nSource: [docs](https://docs.learnbittensor.com/).\n"
);

assert.throws(
  () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" }),
  /duplicate section heading "## Shared Title"/,
  "validator must reject duplicate section headings in published articles"
);

await fs.rm(path.join(pagesDir, "duplicate_headings"), { recursive: true, force: true });
await writeArticle(
  "trimmed_duplicate",
  "## Shared Title\n\nFirst use.\n\n##  Shared Title \n\nWhitespace should not bypass duplicate detection.\n\nSource: [docs](https://docs.learnbittensor.com/).\n"
);

assert.throws(
  () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" }),
  /duplicate section heading "## Shared Title"/,
  "validator must trim section headings before duplicate detection"
);

await fs.rm(path.join(pagesDir, "trimmed_duplicate"), { recursive: true, force: true });
await writeArticle(
  "case_sensitive_headings",
  "## Alpha\n\nFirst.\n\n## alpha\n\nDifferent casing is allowed.\n\nSource: [docs](https://docs.learnbittensor.com/).\n"
);

execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "inherit" });

await fs.rm(fixtureRoot, { recursive: true, force: true });
console.log("Duplicate section heading validation check passed");
