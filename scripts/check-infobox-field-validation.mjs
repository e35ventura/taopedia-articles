import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptPath = path.join(path.dirname(__filename), "validate-content.mjs");
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "taopedia-infobox-field-validation-"));
const pagesDir = path.join(fixtureRoot, "content", "pages");

async function writeArticle(slug, frontMatter, body) {
  const articleDir = path.join(pagesDir, slug);
  await fs.mkdir(articleDir, { recursive: true });
  await fs.writeFile(
    path.join(articleDir, "index.mdx"),
    `---\ntitle: ${slug}\nsummary: Test article.\ncategory: Testing\ntags: []\n${frontMatter}---\n\n${body}\n`
  );
}

await writeArticle(
  "valid_infobox",
  "infoboxTitle: Valid Title\ninfoboxCaption: Valid caption text.\ninfoboxRows:\n  - label: Context\n    value: Example\n",
  "Body with a [source](https://docs.learnbittensor.org/).\n"
);

execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "inherit" });

await writeArticle(
  "long_caption",
  `infoboxTitle: Valid Title\ninfoboxCaption: ${"x".repeat(121)}\n`,
  "Body with a [source](https://docs.learnbittensor.org/).\n"
);

assert.throws(
  () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" }),
  /infoboxCaption" must be 120 characters or fewer/,
  "validator must reject captions longer than 120 characters"
);

await fs.rm(path.join(pagesDir, "long_caption"), { recursive: true, force: true });
await writeArticle(
  "too_many_rows",
  `infoboxRows:\n${Array.from({ length: 9 }, (_, index) => `  - label: Row ${index}\n    value: Value ${index}`).join("\n")}\n`,
  "Body with a [source](https://docs.learnbittensor.org/).\n"
);

assert.throws(
  () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" }),
  /use at most 8 infoboxRows/,
  "validator must reject articles with more than eight infobox rows"
);

await fs.rm(path.join(pagesDir, "too_many_rows"), { recursive: true, force: true });
await writeArticle(
  "long_row_value",
  'infoboxRows:\n  - label: Context\n    value: "' + "y".repeat(121) + '"\n',
  "Body with a [source](https://docs.learnbittensor.org/).\n"
);

assert.throws(
  () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" }),
  /infoboxRows values must be 120 characters or fewer/,
  "validator must reject infobox row values longer than 120 characters"
);

await fs.rm(fixtureRoot, { recursive: true, force: true });
console.log("Infobox field validation check passed");
