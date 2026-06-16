import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// validate-content.mjs rejects active/unsafe content (script tags, inline event
// handlers, dangerous URL schemes) before an article can be published. This test
// pins the dangerous-URL-scheme coverage so it cannot silently regress, and in
// particular guards the SVG/XHTML/script data URLs and vbscript: URLs that the
// app's image-URL sanitizer also blocks but that source validation previously
// missed.

const __filename = fileURLToPath(import.meta.url);
const scriptPath = path.join(path.dirname(__filename), "validate-content.mjs");

async function makeFixture(body) {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "taopedia-content-sanitization-"));
  const articleDir = path.join(fixtureRoot, "content", "pages", "fixture");
  await fs.mkdir(articleDir, { recursive: true });
  await fs.writeFile(
    path.join(articleDir, "index.mdx"),
    `---\ntitle: fixture\nsummary: Test article.\ncategory: Testing\ntags: []\n---\n\n${body}\n`
  );
  return fixtureRoot;
}

function runValidator(fixtureRoot, stdio) {
  return execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio });
}

// A clean article with an ordinary source link passes.
{
  const fixtureRoot = await makeFixture(
    "# Fixture\n\nSource: [docs](https://docs.bittensor.com/).\n"
  );
  runValidator(fixtureRoot, "inherit");
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}

// Each dangerous URL scheme is rejected. Bodies avoid angle brackets and event
// handlers so the only violation is the URL scheme under test, isolating the
// expected error message.
const SAFE_SOURCE = "Source: [docs](https://docs.bittensor.com/).";
const cases = [
  ["javascript: URL", "[x](javascript:void0)", /javascript: URLs are not allowed/],
  ["data:text/html URL", "[x](data:text/html,hello)", /HTML data URLs are not allowed/],
  ["vbscript: URL", "[x](vbscript:foo)", /vbscript: URLs are not allowed/],
  [
    "data:image/svg+xml URL",
    "[x](data:image/svg+xml;base64,abc)",
    /SVG and XHTML data URLs are not allowed/,
  ],
  [
    "data:application/xhtml+xml URL",
    "[x](data:application/xhtml+xml;base64,abc)",
    /SVG and XHTML data URLs are not allowed/,
  ],
  ["data:text/javascript URL", "[x](data:text/javascript,foo)", /script data URLs are not allowed/],
  [
    "data:application/ecmascript URL",
    "[x](data:application/ecmascript,foo)",
    /script data URLs are not allowed/,
  ],
];

for (const [label, link, expected] of cases) {
  const fixtureRoot = await makeFixture(`# Fixture\n\n${SAFE_SOURCE}\n\n${link}\n`);
  assert.throws(
    () => runValidator(fixtureRoot, "pipe"),
    expected,
    `validator must reject a ${label}`
  );
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}

console.log("Content sanitization check passed");
