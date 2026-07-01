import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptPath = path.join(path.dirname(__filename), "validate-content.mjs");
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "taopedia-event-handler-validation-"));
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
  "safe_article",
  "Prose mentioning an on-chain event is fine.\n\nSource: [docs](https://docs.bittensor.com/).\n"
);

execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "inherit" });

await writeArticle(
  "slash_handler_article",
  "Source: [docs](https://docs.bittensor.com/).\n\n<img src=x/onerror=alert(1)>\n"
);

assert.throws(
  () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" }),
  /inline event handlers are not allowed/,
  "validator must reject slash-separated inline event handlers"
);

await fs.rm(path.join(pagesDir, "slash_handler_article"), { recursive: true, force: true });
await writeArticle(
  "space_handler_article",
  "Source: [docs](https://docs.bittensor.com/).\n\n<img src=x onerror=alert(1)>\n"
);

assert.throws(
  () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" }),
  /inline event handlers are not allowed/,
  "validator must still reject whitespace-separated inline event handlers"
);

await fs.rm(fixtureRoot, { recursive: true, force: true });
console.log("Event handler validation check passed");
