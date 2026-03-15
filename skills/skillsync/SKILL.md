---
name: skillsync
description: Discover, fetch, add, and update agent skills from remote storage using the skillsync CLI
---

# SkillSync

SkillSync is a CLI tool for managing agent skills stored in remote storage (Google Drive). Use it to find, install, share, and update skills.

## Prerequisites

A human must run `skillsync setup google` once to configure Google Drive credentials. All other commands are non-interactive and designed for agent use.

## Commands

### Find and install a skill

```bash
# Search by name or description (BM25 ranked — partial/reordered terms work)
skillsync search <query>

# Download and install for this agent
skillsync fetch <name> --agent <agent>

# Install to current project only (instead of global)
skillsync fetch <name> --agent <agent> --scope project
```

Supported agents: `claude`, `codex`, `agents`, `cursor`, `windsurf`, `copilot`, `gemini`, `roo`

### Share a skill

```bash
# Upload a local skill directory to a collection
# The directory must contain a SKILL.md with name and description in YAML frontmatter
skillsync add <path>

# Upload to a specific collection
skillsync add <path> --collection <name>
```

### Update a skill

```bash
# Push local edits back to remote storage
# The skill must have been fetched on this machine first
skillsync update <path>

# If the skill exists in multiple collections, specify which one
skillsync update <path> --collection <name>
```

After updating, the local cache is refreshed so all symlinks on this machine reflect the change immediately.

### Other commands

```bash
# List all available skills across all collections
skillsync list

# Re-discover collections (run if a new collection was created elsewhere)
skillsync refresh

# Create a new collection (Google Drive folder for storing skills)
skillsync collection create [name]
```

## Common Workflows

**User asks to find a skill:**
1. `skillsync search <relevant terms>`
2. `skillsync fetch <skill-name> --agent claude`

**User asks to share a skill they created:**
1. Ensure the skill directory has a `SKILL.md` with `name` and `description` in YAML frontmatter
2. `skillsync add <path-to-skill-directory>`

**User asks to update a skill:**
1. Edit the skill files locally
2. `skillsync update <path-to-skill-directory>`

**User asks to install a skill for this project only:**
1. `skillsync fetch <name> --agent claude --scope project`

## Scope

- `--scope global` (default): installs to `~/.agent/skills/` — available across all projects
- `--scope project`: installs to `./.agent/skills/` in the current working directory — this project only
