---
title: Usage
nav_order: 3
---

# Usage

All commands are non-interactive — safe to call from any AI agent. Commands fail fast with a clear error if something is missing, rather than blocking on user input.

---

## Installing skills

### `skillsmanager install`

Installs the bundled `skillsmanager` skill into all detected agent directories.

```bash
skillsmanager install                   # install to all agents
skillsmanager install --agent claude    # install to a specific agent
skillsmanager install --agent claude,cursor,openclaw  # install to multiple agents
```

### `skillsmanager fetch`

Downloads a skill from remote storage and symlinks it into an agent's skills directory.

```bash
skillsmanager fetch <skill-name> --agent <agent>
```

```bash
skillsmanager fetch code-review --agent claude
skillsmanager fetch write-tests --agent cursor
```

The skill is cached at `~/.skillsmanager/cache/<uuid>/<skill-name>/` and symlinked — one copy, many agents.

---

## Browsing skills

### `skillsmanager list`

Lists all skills available across all collections.

```bash
skillsmanager list
```

### `skillsmanager search`

Full-text BM25 search across skill names and descriptions.

```bash
skillsmanager search <query>
skillsmanager search "code review"
skillsmanager search linkedin
```

---

## Adding and updating skills

### `skillsmanager add`

Uploads a local skill directory to a collection.

```bash
skillsmanager add <path>
skillsmanager add ./my-skill
skillsmanager add ./my-skill --collection work
```

If `--collection` is omitted, the skill is added to the default collection.

### `skillsmanager update`

Pushes local changes to an existing skill back to remote storage.

```bash
skillsmanager update <path>
skillsmanager update ./my-skill
```

---

## Collections

Collections are folders that group related skills. Each collection has a `SKILLS_COLLECTION.yaml` index file.

### `skillsmanager collection create`

Creates a new skill collection.

```bash
skillsmanager collection create
skillsmanager collection create my-collection
```

---

## Registries

A registry is the root index that points to all your collections. See the [Protocol spec](./protocol) for the full architecture.

### `skillsmanager registry create`

Creates a new local registry.

```bash
skillsmanager registry create
skillsmanager registry create --backend gdrive   # create directly in Google Drive
```

### `skillsmanager registry list`

Shows all registries and their collections.

```bash
skillsmanager registry list
```

### `skillsmanager registry push`

Pushes a local registry and all its collections to a remote backend. Transactional — all-or-nothing.

```bash
skillsmanager registry push --backend gdrive
```

### `skillsmanager registry discover`

Searches a backend for existing registries and adds them to local config.

```bash
skillsmanager registry discover --backend gdrive
```

### `skillsmanager registry add-collection`

Adds a collection reference to the registry.

```bash
skillsmanager registry add-collection <name>
```

---

## Discovery and sync

### `skillsmanager refresh`

Re-discovers collections from all connected backends and updates the local index.

```bash
skillsmanager refresh
```

---

## Google Drive setup

### `skillsmanager setup google`

One-time interactive wizard for Google Drive authentication. Human-facing only — not for agent use.

```bash
skillsmanager setup google
```

---

## Config file

All state is stored in `~/.skillsmanager/config.json`. You can inspect it directly — it's plain JSON with registries, collections, and a skills index.

Key paths:

| Path | Purpose |
|---|---|
| `~/.skillsmanager/config.json` | Cached registries, collections, skills index |
| `~/.skillsmanager/registry.yaml` | Local registry |
| `~/.skillsmanager/collections/<name>/` | Local collection storage |
| `~/.skillsmanager/credentials.json` | Google OAuth client credentials |
| `~/.skillsmanager/token.json` | OAuth access + refresh token |
| `~/.skillsmanager/cache/<uuid>/<skill>/` | Downloaded skill cache |
