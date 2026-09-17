# Repository Agent Instructions

This directory is the vendor-neutral source of repository guidance and feature specifications for any AI agent working on SnapWorth.

## Required reading

- Before designing, scaffolding, implementing, or reviewing frontend UI, read `agents/skills/offbrand-design/SKILL.md` and follow its design, accessibility, motion, performance, token, and component requirements throughout the task.
- Before implementation, read the current feature specification under `agents/specs/`, including its requirements and any available design, configuration, and task documents.
- Treat `agents/skills/offbrand-design/SKILL.md` as vendor-neutral Markdown. Its YAML frontmatter is metadata and does not require Kiro or any other specific AI tool.

## Canonical architecture

- Use `Frontend/web/` for the website and desktop shell.
- Use `Frontend/mobile/` for the future shared Expo Android and iOS shell.
- Use `Frontend/shared/` for cross-platform product code.
- Use the single shared `Backend/` for all platforms.

Do not create vendor-specific duplicates of this guidance. This file is the single cross-agent index.

## Manual invocation

When an agent does not discover these instructions automatically, invoke the skill with this exact prompt:

`Read agents/skills/offbrand-design/SKILL.md before designing or implementing UI. Follow its requirements throughout the task.`
