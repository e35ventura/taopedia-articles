import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptPath = path.join(path.dirname(__filename), "validate-content.mjs");
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "taopedia-code-block-validation-"));
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
  "valid_article",
  "Inline `btcli subnet register` mentions are fine.\n\nSource: [docs](https://docs.bittensor.com/).\n"
);
await writeArticle(
  "draft_article",
  "Draft pages can keep rough setup notes.\n\n```bash\nbtcli subnet register\n```\n",
  true
);

execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "inherit" });

await writeArticle(
  "fenced_article",
  "Published articles should explain setup in prose.\n\n   ```bash\n   btcli subnet register\n   ```\n\nSource: [docs](https://docs.bittensor.com/).\n"
);

assert.throws(
  () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" }),
  /published articles must not contain fenced code blocks/,
  "validator must reject fenced code blocks in published articles"
);

await fs.rm(path.join(pagesDir, "fenced_article"), { recursive: true, force: true });
await writeArticle(
  "tilde_fenced_article",
  "Published articles should also avoid tilde fences.\n\n~~~\nGET /api/v1/auctions\n~~~\n\nSource: [docs](https://docs.bittensor.com/).\n"
);

assert.throws(
  () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" }),
  /published articles must not contain fenced code blocks/,
  "validator must reject tilde fenced code blocks in published articles"
);

await fs.rm(fixtureRoot, { recursive: true, force: true });
console.log("Code block validation check passed");
