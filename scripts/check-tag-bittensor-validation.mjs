import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptPath = path.join(path.dirname(__filename), "validate-content.mjs");
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "taopedia-tag-validation-"));
const pagesDir = path.join(fixtureRoot, "content", "pages");

function childProcessOutput(error) {
  return Buffer.concat(
    [error.stdout, error.stderr].filter((chunk) => Buffer.isBuffer(chunk))
  ).toString();
}

function runValidator() {
  return execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" });
}

function assertValidatorFails(pattern, message) {
  let error;
  try {
    runValidator();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error, message);
  assert.match(childProcessOutput(error), pattern, message);
}

async function writeArticle(slug, tags) {
  const articleDir = path.join(pagesDir, slug);
  await fs.mkdir(articleDir, { recursive: true });
  await fs.writeFile(
    path.join(articleDir, "index.mdx"),
    `---\ntitle: ${slug}\nsummary: Test article.\ncategory: Testing\ntags: ${tags}\n---\n\nSource: [docs](https://docs.bittensor.com/).\n`
  );
}

async function removeArticle(slug) {
  await fs.rm(path.join(pagesDir, slug), { recursive: true, force: true });
}

try {
  await writeArticle("valid_tag", '["Staking"]');
  await writeArticle("valid_padded_tag", '[" Staking "]');
  await writeArticle("valid_padded_forty_char_tag", `[" ${"a".repeat(40)} "]`);
  runValidator();

  await writeArticle("padded_bittensor_tag", '[" Bittensor "]');
  assertValidatorFails(
    /do not use "Bittensor" as a tag/,
    'validator must reject whitespace-padded "Bittensor" tags'
  );
  await removeArticle("padded_bittensor_tag");

  await writeArticle("mixed_case_bittensor_tag", '[" bitTENsor "]');
  assertValidatorFails(
    /do not use "Bittensor" as a tag/,
    'validator must reject whitespace-padded mixed-case "Bittensor" tags'
  );
  await removeArticle("mixed_case_bittensor_tag");

  await writeArticle("too_long_tag", `["${"a".repeat(41)}"]`);
  assertValidatorFails(
    /tags must be 40 characters or fewer/,
    "validator must still reject normalized tags longer than 40 characters"
  );
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}

console.log("Bittensor tag validation check passed");
