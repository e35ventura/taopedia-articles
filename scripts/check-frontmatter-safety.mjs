import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptPath = path.join(path.dirname(__filename), "validate-content.mjs");
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "taopedia-frontmatter-"));
const pagesDir = path.join(fixtureRoot, "content", "pages");

async function writeRaw(slug, raw) {
  const articleDir = path.join(pagesDir, slug);
  await fs.mkdir(articleDir, { recursive: true });
  await fs.writeFile(path.join(articleDir, "index.mdx"), raw);
}

function validate() {
  return execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" });
}

async function reset() {
  await fs.rm(pagesDir, { recursive: true, force: true });
}

const SOURCE = "Source: [docs](https://docs.bittensor.com/).";

// A normal article (no anchors, `&`/`*` only in body prose) must pass.
await writeRaw(
  "clean",
  `---\ntitle: Clean\nsummary: Test.\ncategory: Testing\ntags: []\n---\n\n` +
    `Weights *update* when validator A & B agree. ${SOURCE}\n`
);
validate();

// A YAML anchor/alias "billion laughs" bomb in front matter must be rejected.
await reset();
await writeRaw(
  "yaml_bomb",
  `---\n` +
    `a: &a ["x","x","x","x","x","x","x","x","x","x"]\n` +
    `b: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a,*a]\n` +
    `c: [*b,*b,*b,*b,*b,*b,*b,*b,*b,*b]\n` +
    `title: Bomb\nsummary: Test.\ncategory: Testing\ntags: []\n---\n\n${SOURCE}\n`
);
assert.throws(
  validate,
  /YAML anchors, aliases, and merge keys are not allowed/,
  "validator must reject YAML anchors/aliases in front matter"
);

// A YAML merge key in front matter must be rejected.
await reset();
await writeRaw(
  "merge_key",
  `---\nanchored: &node\n  k: v\nmerged:\n  <<: *node\ntitle: Merge\nsummary: Test.\ncategory: Testing\ntags: []\n---\n\n${SOURCE}\n`
);
assert.throws(
  validate,
  /YAML anchors, aliases, and merge keys are not allowed/,
  "validator must reject YAML merge keys in front matter"
);

await fs.rm(fixtureRoot, { recursive: true, force: true });
console.log("Front matter safety check passed");
