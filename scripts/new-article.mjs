import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PAGES_DIR = path.join(ROOT, "content/pages");

function titleToSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

async function main() {
  const title = process.argv.slice(2).join(" ").trim();
  if (!title) {
    console.error('Usage: npm run new-article -- "Article Title"');
    process.exit(1);
  }

  const slug = titleToSlug(title);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
    console.error(
      `Could not produce a valid slug from "${title}". Use letters, numbers, spaces, underscores, and hyphens.`
    );
    process.exit(1);
  }

  const articleDir = path.join(PAGES_DIR, slug);
  try {
    await fs.access(articleDir);
    console.error(`Article already exists: content/pages/${slug}/`);
    process.exit(1);
  } catch {
    // Directory does not exist — safe to proceed.
  }

  await fs.mkdir(articleDir, { recursive: true });

  const mdx = `---
title: "${title}"
summary: ""
category: ""
tags: []
---

# ${title}

TODO: Write the article body here.

## Sources

- [Source Title](https://example.com)
`;

  const articlePath = path.join(articleDir, "index.mdx");
  await fs.writeFile(articlePath, mdx);

  console.log(`Created content/pages/${slug}/index.mdx`);
  console.log(`
Next steps:
  1. Fill in summary    (required, ≤240 chars)
  2. Set category       (required, ≤60 chars, not "Bittensor")
  3. Add tags           (optional, 0–3 tags, ≤40 chars each, not "Bittensor")
  4. Write the body
  5. Replace the placeholder source with real source links
  6. Run: npm run validate`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
