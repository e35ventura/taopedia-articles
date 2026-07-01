import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptPath = path.join(path.dirname(__filename), "validate-content.mjs");
const fixtureRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "taopedia-duplicate-title-validation-")
);
const pagesDir = path.join(fixtureRoot, "content", "pages");

async function writeArticle(slug, title, draft = false) {
  const articleDir = path.join(pagesDir, slug);
  await fs.mkdir(articleDir, { recursive: true });
  const draftField = draft ? "draft: true\n" : "";
  await fs.writeFile(
    path.join(articleDir, "index.mdx"),
    `---\n${draftField}title: "${title}"\nsummary: Test article.\ncategory: Testing\ntags: []\n---\n\nSource: [docs](https://docs.bittensor.com/).\n`
  );
}

// Distinct titles that resolve to distinct wiki-link targets validate cleanly.
await writeArticle("alpha_one", "Alpha One");
await writeArticle("alpha_two", "Alpha Two");

execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "inherit" });

// Two published articles whose titles collapse to the same [[wiki link]] target
// (case and punctuation are normalized away) are ambiguous and must be rejected.
await writeArticle("uid_vec_contain_invalid_one", "UID Vec Contain Invalid One");
await writeArticle("uid_vec_contains_invalid_one", "Uid Vec Contain Invalid One");

assert.throws(
  () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" }),
  /Duplicate published article title/,
  "validator must reject published articles whose titles resolve to the same wiki-link target"
);

// A draft article sharing the target does not publish, so it must not trip the gate.
await fs.rm(path.join(pagesDir, "uid_vec_contains_invalid_one"), { recursive: true, force: true });
await writeArticle("uid_vec_contains_invalid_one", "Uid Vec Contain Invalid One", true);

execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "inherit" });

await fs.rm(fixtureRoot, { recursive: true, force: true });
console.log("Duplicate title validation check passed");
