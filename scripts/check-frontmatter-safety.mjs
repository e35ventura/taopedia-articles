import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(__filename);
const validateScript = path.join(scriptDir, "validate-content.mjs");
const buildIndexScript = path.join(scriptDir, "build-index.mjs");
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "taopedia-frontmatter-safety-"));
const pagesDir = path.join(fixtureRoot, "content", "pages");
const indexPath = path.join(fixtureRoot, "content", "index", "articles.jsonl");

async function writeRawArticle(slug, raw) {
  const articleDir = path.join(pagesDir, slug);
  await fs.mkdir(articleDir, { recursive: true });
  await fs.writeFile(path.join(articleDir, "index.mdx"), raw);
}

async function removeArticle(slug) {
  await fs.rm(path.join(pagesDir, slug), { recursive: true, force: true });
}

function runScript(scriptPath) {
  return execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" });
}

function assertScriptThrows(scriptPath, pattern, message) {
  assert.throws(() => runScript(scriptPath), pattern, message);
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

try {
  await writeRawArticle(
    "known_target",
    `---
title: Known Target
summary: Test article.
category: Testing
tags: []
---

# Known Target

Source: [docs](https://docs.bittensor.com/).
`
  );

  runScript(validateScript);
  runScript(buildIndexScript);
  assert.match(
    await fs.readFile(indexPath, "utf8"),
    /"slug":"known_target"/,
    "safe YAML front matter should validate and index"
  );

  const markerPath = path.join(fixtureRoot, "js-frontmatter-executed");
  await writeRawArticle(
    "js_frontmatter",
    `---js
require("node:fs").writeFileSync(${JSON.stringify(markerPath)}, "executed");
({ title: "Unsafe", summary: "Unsafe article.", category: "Testing", tags: [] })
---

Source: [docs](https://docs.bittensor.com/).
`
  );

  assertScriptThrows(
    validateScript,
    /plain YAML delimiter/,
    "validator must reject JavaScript front matter before parsing"
  );
  assertScriptThrows(
    buildIndexScript,
    /plain YAML delimiter/,
    "index builder must reject JavaScript front matter before parsing"
  );
  assert.equal(await pathExists(markerPath), false, "JavaScript front matter must not execute");
  await removeArticle("js_frontmatter");

  const crMarkerPath = path.join(fixtureRoot, "cr-js-frontmatter-executed");
  await writeRawArticle(
    "cr_js_frontmatter",
    `---\rjs
require("node:fs").writeFileSync(${JSON.stringify(crMarkerPath)}, "executed");
({ title: "Unsafe", summary: "Unsafe article.", category: "Testing", tags: [] })
---

Source: [docs](https://docs.bittensor.com/).
`
  );

  assertScriptThrows(
    validateScript,
    /plain YAML delimiter/,
    "validator must reject carriage-return JavaScript front matter before parsing"
  );
  assertScriptThrows(
    buildIndexScript,
    /plain YAML delimiter/,
    "index builder must reject carriage-return JavaScript front matter before parsing"
  );
  assert.equal(
    await pathExists(crMarkerPath),
    false,
    "carriage-return JavaScript must not execute"
  );
  await removeArticle("cr_js_frontmatter");

  await writeRawArticle(
    "malformed_frontmatter",
    `---
title: [unterminated
---

Source: [docs](https://docs.bittensor.com/).
`
  );

  assertScriptThrows(
    validateScript,
    /invalid YAML front matter/,
    "validator must fail closed on malformed front matter"
  );
  assertScriptThrows(
    buildIndexScript,
    /invalid YAML front matter/,
    "index builder must fail closed on malformed front matter"
  );
  await removeArticle("malformed_frontmatter");

  await writeRawArticle(
    "recursive_frontmatter",
    `---
title: Recursive Front Matter
summary: Test article.
category: Testing
tags: []
loop: &loop
  child: *loop
---

Source: [docs](https://docs.bittensor.com/).
`
  );

  assertScriptThrows(
    validateScript,
    /recursive aliases/,
    "validator must reject recursive front matter aliases with a controlled error"
  );
  assertScriptThrows(
    buildIndexScript,
    /recursive aliases/,
    "index builder must reject recursive front matter aliases with a controlled error"
  );

  console.log("Front matter safety check passed");
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}
