import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptPath = path.join(path.dirname(__filename), "validate-content.mjs");
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "taopedia-link-validation-"));
const pagesDir = path.join(fixtureRoot, "content", "pages");

async function writeArticle(slug, body, frontMatter = "", draft = false) {
  const articleDir = path.join(pagesDir, slug);
  await fs.mkdir(articleDir, { recursive: true });
  const draftField = draft ? "draft: true\n" : "";
  await fs.writeFile(
    path.join(articleDir, "index.mdx"),
    `---\n${draftField}title: ${slug}\nsummary: Test article.\ncategory: Testing\ntags: []\n${frontMatter}---\n\n${body}\n`
  );
}

await writeArticle(
  "known_target",
  "# Known Target\n\nSource: [docs](https://docs.bittensor.com/).\n"
);
await writeArticle(
  "valid_link",
  "See [[known target]].\n\nSource: [docs](https://docs.bittensor.com/).\n"
);
await writeArticle(
  "valid_frontmatter_link",
  "# Valid Frontmatter Link\n\nSource: [docs](https://docs.bittensor.com/).\n",
  'infoboxRows:\n  - label: Related\n    value: "[[known target|Known Target]]"\n'
);

execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "inherit" });

await writeArticle(
  "broken_link",
  "See [[missing target]].\n\nSource: [docs](https://docs.bittensor.com/).\n"
);

assert.throws(
  () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" }),
  /does not resolve to an article/,
  "validator must reject unresolved internal wiki links"
);

await fs.rm(path.join(pagesDir, "broken_link"), { recursive: true, force: true });
await writeArticle(
  "broken_frontmatter_link",
  "# Broken Frontmatter Link\n\nSource: [docs](https://docs.bittensor.com/).\n",
  'infoboxRows:\n  - label: Related\n    value: "[[missing target|Missing Target]]"\n'
);

assert.throws(
  () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" }),
  /does not resolve to an article/,
  "validator must reject unresolved front matter wiki links"
);

await fs.rm(path.join(pagesDir, "broken_frontmatter_link"), { recursive: true, force: true });
await writeArticle(
  "fenced_wiki_example",
  "Draft tutorials can show wiki syntax inside fenced examples.\n\n```md\nSee [[missing target]] for details.\n```\n",
  "",
  true
);

execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "inherit" });

await fs.rm(path.join(pagesDir, "fenced_wiki_example"), { recursive: true, force: true });
await writeArticle(
  "inline_wiki_example",
  "Inline `[[missing target]]` mentions are not wiki links.\n\nSource: [docs](https://docs.bittensor.com/).\n"
);

execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "inherit" });

await fs.rm(fixtureRoot, { recursive: true, force: true });
console.log("Internal link validation check passed");
