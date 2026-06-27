const wikiLinkPattern = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
const markdownHttpLinkPattern = /!?\[[^\]]+\]\(https?:\/\/[^)]+\)/gi;

// Markdown syntax shown inside code (tutorial examples, API samples) is not a real
// wiki link or source citation, so ignore fenced blocks and inline code spans first.
export function stripMarkdownCode(content) {
  return content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/~~~[\s\S]*?~~~/g, "")
    .replace(/`[^`\n]*`/g, "");
}

export function extractWikiLinks(content) {
  return [...content.matchAll(wikiLinkPattern)].map((match) => match[1].trim());
}

export function extractWikiLinksFromValue(value) {
  if (typeof value === "string") return extractWikiLinks(value);
  if (Array.isArray(value)) return value.flatMap((item) => extractWikiLinksFromValue(item));
  if (value && typeof value === "object") {
    return Object.values(value).flatMap((item) => extractWikiLinksFromValue(item));
  }
  return [];
}

export function extractProseWikiLinks(content, frontMatter) {
  const prose = stripMarkdownCode(content);
  return [...extractWikiLinks(prose), ...extractWikiLinksFromValue(frontMatter)];
}

export function hasProseSourceLink(content) {
  for (const match of stripMarkdownCode(content).matchAll(markdownHttpLinkPattern)) {
    if (!match[0].startsWith("!")) return true;
  }
  return false;
}
