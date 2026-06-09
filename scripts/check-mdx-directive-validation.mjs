import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptPath = path.join(path.dirname(__filename), "validate-content.mjs");
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "taopedia-mdx-directive-"));
const pagesDir = path.join(fixtureRoot, "content", "pages");

async function writeArticle(slug, body) {
  const articleDir = path.join(pagesDir, slug);
  await fs.mkdir(articleDir, { recursive: true });
  await fs.writeFile(
    path.join(articleDir, "index.mdx"),
    `---\ntitle: ${slug}\nsummary: Test article.\ncategory: Testing\ntags: []\n---\n\n${body}\n`
  );
}

function validate() {
  return execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" });
}

// Prose whose wrapped lines begin with "import"/"export" must validate cleanly.
await writeArticle(
  "prose_import",
  "To restore a wallet you provide the mnemonic phrase that btcli will use to\n" +
    "import the coldkey into local storage. See [docs](https://docs.bittensor.com/)."
);
await writeArticle(
  "prose_export",
  "Operators sometimes need to securely\n" +
    "export the encrypted hotkey. See [docs](https://docs.bittensor.com/)."
);

validate();

// Real MDX import/export statements must still be rejected.
const offenders = [
  [
    "mdx_import_from",
    'import Chart from "./chart.js"\n\nSource: [docs](https://docs.bittensor.com/).',
  ],
  ["mdx_import_bare", 'import "./styles.css"\n\nSource: [docs](https://docs.bittensor.com/).'],
  [
    "mdx_export_const",
    "export const meta = { a: 1 }\n\nSource: [docs](https://docs.bittensor.com/).",
  ],
  ["mdx_export_default", "export default Foo\n\nSource: [docs](https://docs.bittensor.com/)."],
];

for (const [slug, body] of offenders) {
  await fs.rm(pagesDir, { recursive: true, force: true });
  await writeArticle(slug, body);
  assert.throws(
    validate,
    /MDX (imports|exports) are not allowed/,
    `validator must reject real MDX directive in "${slug}"`
  );
}

await fs.rm(fixtureRoot, { recursive: true, force: true });
console.log("MDX directive validation check passed");
