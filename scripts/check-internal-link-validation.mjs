import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptPath = path.join(path.dirname(__filename), "validate-content.mjs");
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "taopedia-link-validation-"));
const pagesDir = path.join(fixtureRoot, "content", "pages");

async function writeArticle(slug, body) {
  const articleDir = path.join(pagesDir, slug);
  await fs.mkdir(articleDir, { recursive: true });
  await fs.writeFile(
    path.join(articleDir, "index.mdx"),
    `---\ntitle: ${slug}\nsummary: Test article.\ncategory: Testing\ntags: []\n---\n\n${body}\n`
  );
}

await writeArticle(
  "known_target",
  "# Known Target\n\nSource: [docs](https://docs.bittensor.com/).\n"
);
await writeArticle(
  "valid_link",
  "See [[known target]].\n\nSource: [docs](https://docs.bittensor.com/).\n"
);

execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "inherit" });

await writeArticle(
  "broken_link",
  "See [[missing target]].\n\nSource: [docs](https://docs.bittensor.com/).\n"
);

assert.throws(
  () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" }),
  /does not resolve to an article/,
  "validator must reject unresolved internal wiki links"
);

await fs.rm(fixtureRoot, { recursive: true, force: true });
console.log("Internal link validation check passed");
