# Contributing To Taopedia Articles

Thanks for improving Taopedia. This repository is for article content only. Website code, UI,
routing, and deployment config belong in:

https://github.com/e35ventura/taopedia

## Quick Start

1. Fork or branch from `test`.
2. Add or edit an article under `content/pages/<slug>/index.mdx`.
3. Use the required front matter.
4. Keep the article factual, concise, and Bittensor-focused.
5. Open a pull request targeting `test`.

Before opening a PR, run:

```bash
npm run format:check
npm run validate
```

## File Layout

```txt
content/pages/<slug>/index.mdx
```

Use lowercase slugs with words separated by underscores when possible:

```txt
content/pages/yuma_consensus/index.mdx
content/pages/dynamic_tao/index.mdx
```

Place images beside the article and reference them with relative paths:

```txt
content/pages/dynamic_tao/
  index.mdx
  emission-flow.png
```

```mdx
![Emission flow](./emission-flow.png)
```

## Required Front Matter

```mdx
---
title: "Dynamic TAO"
summary: "How Dynamic TAO changes subnet tokenomics and incentive allocation in Bittensor."
category: "Tokenomics"
tags: ["TAO", "Subnets"]
---
```

Required fields:

- `title`: Human-readable article title.
- `summary`: One sentence, preferably under 180 characters.
- `category`: One primary topic. Do not use `Bittensor` as a catch-all category.
- `tags`: Zero to three specific topic tags. Do not use `Bittensor`; every published Taopedia
  article is already Bittensor-focused.

Optional fields:

- `featured`: `true` for especially important pages.
- `draft`: `true` to keep unfinished work out of normal publication.
- `infoboxTitle`: Title shown in the article infobox.
- `infoboxCaption`: Short caption below the infobox image.
- `infoboxImage`: URL or local image path.
- `infoboxRows`: List of short `{ label, value }` rows.

## Bittensor Scope

Taopedia is Bittensor-centric. Good topics include:

- TAO
- wallets, coldkeys, and hotkeys
- staking and delegation
- validators and miners
- Yuma Consensus
- Dynamic TAO
- subnets and incentive mechanisms
- Bittensor governance, emissions, and operations

The Taopedia app publishes every article that is not marked `draft: true`. Articles must be
Bittensor-focused; general sample articles should not be added to this repository. Categories can be
added over time without changing the website sync logic.

## Writing Style

- Write for builders, validators, miners, and TAO holders.
- Be factual and direct.
- Define terms before using jargon heavily.
- Prefer short sections with clear headings.
- Avoid repeating the same definition, claim, or caveat.
- Cut generic blockchain, AI, decentralization, or crypto filler unless it directly explains the
  Bittensor topic.
- Keep sentences direct; do not use a long explanation when a short one preserves the meaning.
- Every section should add a new fact, distinction, caveat, source, or operational detail.
- Use `[[Article Title]]` for internal links.
- Cite official docs or primary sources when making claims.
- Link relevant codebases, source files, releases, or commits when describing implementation
  behavior.
- Avoid price predictions, investment advice, hype, or unsupported claims.

## Sources

Sources are required for factual and technical claims. AI-assisted writing is allowed, but unsourced
writing is not.

Preferred sources:

1. Current implementation code, official protocol repos, and release notes.
2. Official Bittensor/OpenTensor docs.
3. Maintainer-authored specs or documentation.
4. Reputable third-party explainers for background only.

When docs and code disagree, code is the source of truth for implementation behavior. Docs can
support conceptual explanations, but exact mechanics should be backed by code, release notes, or
official specs.

Do not use generic homepages, SEO pages, social posts, or screenshots as support for technical
claims unless they are clearly marked as context and no stronger source exists.

## Internal Links

Use wiki-style links:

```mdx
See [[Yuma Consensus]] and [[Dynamic TAO]].
```

The app resolves these links to Taopedia article pages and uses them to build backlinks.

## Infobox Example

```yaml
infoboxTitle: Dynamic TAO
infoboxCaption: Subnet tokenomics and emissions.
infoboxRows:
  - label: Network
    value: Bittensor
  - label: Asset
    value: TAO
  - label: Related
    value: "[[Subnets]]"
```

Keep infobox values short. Use the main article body for explanation.

## Pull Request Checklist

- Required front matter is present.
- The article is in `content/pages/<slug>/index.mdx`.
- The topic is Bittensor-related or intentionally marked as a sample/reference page.
- Internal links use `[[...]]`.
- Sources are included for technical or factual claims.
- Codebase links are included when implementation behavior is described.
- The article avoids repeated information and unnecessary filler.
- Images are local or from trusted sources.
- Spelling and grammar have been checked.
- `npm run format:check` succeeds if dependencies are installed.
- `npm run build:index` succeeds if dependencies are installed.

## Deployment

Merging to `test` validates and stages article changes without updating production. Maintainers
promote `test` to `main` with the release workflow when changes are ready. Merging to `main` updates
the article index and the live site after the Taopedia rebuild finishes.
