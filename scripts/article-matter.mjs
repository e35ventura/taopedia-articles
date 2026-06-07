import matter from "gray-matter";

const maxFrontMatterDepth = 20;

function assertFrontMatterTreeIsSafe(value, filePath, stack = new WeakSet(), depth = 0) {
  if (!value || typeof value !== "object") return;
  if (depth > maxFrontMatterDepth) {
    throw new Error(`${filePath}: front matter is too deeply nested to scan safely`);
  }
  if (stack.has(value)) {
    throw new Error(`${filePath}: front matter contains recursive aliases`);
  }

  stack.add(value);
  try {
    const values = Array.isArray(value) ? value : Object.values(value);
    for (const item of values) assertFrontMatterTreeIsSafe(item, filePath, stack, depth + 1);
  } finally {
    stack.delete(value);
  }
}

export function parseArticleMatter(raw, filePath) {
  const normalized = raw.startsWith("\uFEFF") ? raw.slice(1) : raw;

  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) {
    throw new Error(`${filePath}: front matter must start with a plain YAML delimiter (---)`);
  }

  let parsed;
  try {
    parsed = matter(normalized);
  } catch (error) {
    throw new Error(`${filePath}: invalid YAML front matter: ${error.message}`);
  }
  assertFrontMatterTreeIsSafe(parsed.data, filePath);
  return parsed;
}
