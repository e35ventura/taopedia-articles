import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptPath = path.join(path.dirname(__filename), "validate-content.mjs");
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "taopedia-sanitizer-"));
const pagesDir = path.join(fixtureRoot, "content", "pages");

async function writeArticle(slug, body) {
  const articleDir = path.join(pagesDir, slug);
  await fs.mkdir(articleDir, { recursive: true });
  await fs.writeFile(
    path.join(articleDir, "index.mdx"),
    `---\ntitle: ${slug}\nsummary: Test article.\ncategory: Testing\ntags: []\n---\n\n${body}\n`
  );
  return articleDir;
}

function validate() {
  return execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" });
}

async function reset() {
  await fs.rm(pagesDir, { recursive: true, force: true });
}

// Clean article passes.
await writeArticle("clean", "Plain prose. See [docs](https://docs.bittensor.com/).");
validate();

// Each hardening must reject its payload.
const rejected = [
  ["base_tag", '<base href="https://evil.example/" />', /active HTML elements are not allowed/],
  ["entity_js", "[x](java&#115;cript:alert(1))", /javascript: URLs are not allowed/],
  ["named_colon_js", "[x](javascript&colon;alert(1))", /javascript: URLs are not allowed/],
  ["entity_data_html", "[x](data&colon;text/html;base64,abcd)", /HTML data URLs are not allowed/],
];

for (const [slug, body, expected] of rejected) {
  await reset();
  await writeArticle(slug, `${body}\n\nSource: [docs](https://docs.bittensor.com/).`);
  assert.throws(validate, expected, `validator must reject ${slug}`);
}

// Symlinked asset must be rejected.
await reset();
const dir = await writeArticle("symlinked", "Source: [docs](https://docs.bittensor.com/).");
await fs.symlink("/etc/hostname", path.join(dir, "leak.png"));
assert.throws(validate, /[Ss]ymlinked article/, "validator must reject symlinked assets");

await fs.rm(fixtureRoot, { recursive: true, force: true });
console.log("Sanitizer hardening check passed");
