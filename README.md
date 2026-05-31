# Taopedia Articles

This repository contains the public MDX article source for Taopedia, a Bittensor-focused knowledge
base.

Live site:

https://taopedia.org

Website app:

https://github.com/e35ventura/taopedia

## Repository Role

- Contributors add and edit articles here.
- Articles are stored as MDX under `content/pages`.
- The Taopedia website syncs Bittensor-scoped articles from this repo during the site build.
- Contributor PRs target `test`.
- Maintainers promote `test` to `main` after review.

If you want to change the website UI, routing, styling, search, or deployment config, use
`taopedia`. If you want to improve Taopedia's knowledge base, use this repo.

## What To Contribute

Good changes for this repo include:

- New Bittensor articles.
- Corrections to existing articles.
- Better sources for factual or technical claims.
- Local images or diagrams that clarify an article.
- Category or tag improvements.
- Concision edits that remove repetition or filler.

Articles should be factual, sourced, concise, and useful to builders, validators, miners, and TAO
holders.

## Article Layout

Each article gets its own folder:

```txt
content/pages/<slug>/index.mdx
```

Optional images or supporting files can live beside the article:

```txt
content/pages/<slug>/
  index.mdx
  diagram.png
```

Reference local assets with relative paths:

```mdx
![Emission flow](./diagram.png)
```

## Required Front Matter

```mdx
---
title: "Your Article Title"
summary: "One clear sentence describing the article."
category: "Wallets"
tags: ["Wallets"]
---
```

Required fields:

- `title`: Display title.
- `summary`: Short description used in listings and search.
- `category`: One primary topic. Do not use `Bittensor` as a catch-all category.
- `tags`: Zero to three specific topic tags. Do not use `Bittensor`; every published Taopedia
  article is already Bittensor-focused.

Optional fields:

- `featured`
- `draft`
- `infoboxTitle`
- `infoboxCaption`
- `infoboxImage`
- `infoboxRows`

## Publication Rules

Taopedia publishes every article that is not marked `draft: true`. Articles must be
Bittensor-focused; general sample articles should not be added to this repository. Categories can be
added over time without changing website sync logic.

## Source Standard

Sources are required for factual and technical claims. Prefer:

1. Current implementation code, official protocol repos, and release notes.
2. Official Bittensor/OpenTensor docs.
3. Maintainer-authored specs or documentation.
4. Reputable third-party explainers for background only.

When docs and code disagree, implementation code is the source of truth for implementation behavior.

## Local Checks

```bash
npm install
npm run format:check
npm run validate
npm run build:index
```

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR.
