import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// validate-content.mjs derives its pages directory from process.cwd()
// (`const root = process.cwd(); const pagesDir = path.join(root, "content/pages");`),
// so each run is pointed at a throwaway fixture root via execFileSync's `cwd`.
// Fixture values follow the validator's own rules and mirror the existing
// committed check-*.mjs regression scripts:
//   - category "Testing" is accepted: the validator only rejects category==="Bittensor"
//     (there is no category allowlist; any non-empty <=60-char string that is not
//     "Bittensor" passes validateTextField + the category check).
//   - slugs "legit_tag"/"padded_bittensor_tag" are accepted: validateSlug enforces
//     ^[a-z0-9][a-z0-9_-]*$ , which permits lowercase letters, digits, underscores,
//     and hyphens.
const __filename = fileURLToPath(import.meta.url);
const scriptPath = path.join(path.dirname(__filename), "validate-content.mjs");
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "taopedia-tag-blocklist-"));
const pagesDir = path.join(fixtureRoot, "content", "pages");

async function writeArticle(slug, tags, body) {
  const articleDir = path.join(pagesDir, slug);
  await fs.mkdir(articleDir, { recursive: true });
  await fs.writeFile(
    path.join(articleDir, "index.mdx"),
    `---\ntitle: ${slug}\nsummary: Test article.\ncategory: Testing\ntags: ${tags}\n---\n\n${body}\n`
  );
}

const sourceBody = "Source: [docs](https://docs.bittensor.com/).\n";

// Wrap the fixture body in try/finally so the temp directory is always removed,
// including when the control validation fails, the rejection assertion fails, or
// the child process throws an unexpected error. This script runs on every PR via
// `npm run validate`, so it must never leak temp fixture directories on failure.
try {
  // Control case: a non-Bittensor tag must pass validation, so the blocklist does
  // not over-reject legitimate tags.
  await writeArticle("legit_tag", '["Staking"]', sourceBody);
  execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "inherit" });

  // Whitespace-padded "Bittensor" tag must be rejected, matching the category
  // blocklist which already trims before comparing.
  await writeArticle("padded_bittensor_tag", '[" Bittensor "]', sourceBody);
  assert.throws(
    () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" }),
    /do not use "Bittensor" as a tag/,
    "validator must reject whitespace-padded Bittensor tags"
  );

  console.log("Tag Bittensor blocklist validation check passed");
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}
