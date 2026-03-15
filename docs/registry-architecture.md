# Registry Architecture

## Overview

SkillSync uses a two-tier architecture for organizing skills:

```
SKILLSYNC_REGISTRY.yaml          ← root index (points to all collections)
├── Collection A/
│   ├── SKILLSYNC_COLLECTION.yaml
│   ├── skill_1/
│   └── skill_2/
├── Collection B/
│   ├── SKILLSYNC_COLLECTION.yaml
│   └── skill_3/
└── ...
```

A **registry** is the root node. It lists all **collections** the user has access to, regardless of where they're stored (local filesystem, Google Drive, GitHub, etc.).

A **collection** is a folder containing skills, indexed by a `SKILLSYNC_COLLECTION.yaml` file.

## File Formats

### SKILLSYNC_REGISTRY.yaml

```yaml
name: ajay-skills
owner: ajay@example.com
source: local                         # where this registry lives
collections:
  - name: my_skills
    backend: local                    # stored locally
    ref: my_skills                    # directory name under ~/.skillssync/collections/
  - name: team_prompts
    backend: gdrive                   # stored in Google Drive
    ref: SKILLSYNC_TEAM_PROMPTS       # Drive folder name
```

### SKILLSYNC_COLLECTION.yaml

```yaml
name: my_skills
owner: ajay@example.com
skills:
  - name: write_linkedin_post
    path: write_linkedin_post/
    description: Writes LinkedIn posts for professional networking
```

Previously named `SKILLS_SYNC.yaml` — the old name is still recognized for backwards compatibility.

## Storage Backends

### Local (default)

No setup required. Everything stored under `~/.skillssync/`:

```
~/.skillssync/
├── config.json              ← cached config
├── registry.yaml            ← local registry
├── collections/
│   └── my_skills/
│       ├── SKILLSYNC_COLLECTION.yaml
│       └── write_linkedin_post/
│           └── SKILL.md
└── cache/                   ← cache for remote skills
```

### Google Drive

Requires `skillsync setup google` first. Registry and collections are stored as Drive folders.

```
Google Drive:
├── SKILLSYNC_REGISTRY/
│   └── SKILLSYNC_REGISTRY.yaml
├── SKILLSYNC_MY_SKILLS/
│   ├── SKILLSYNC_COLLECTION.yaml
│   └── write_linkedin_post/
│       └── SKILL.md
└── ...
```

## Discovery Flow

When skillsync needs to find skills, it follows a two-phase process:

### Phase 1: Registry path
1. Search for `SKILLSYNC_REGISTRY.yaml` files owned by the current user
2. Read each registry → get collection references
3. Resolve each reference to a concrete collection

### Phase 2: Orphan fallback
1. Scan for `SKILLSYNC_COLLECTION.yaml` (or legacy `SKILLS_SYNC.yaml`) directly
2. Any collections found that aren't already known from Phase 1 are added
3. This ensures backwards compatibility with collections created before the registry existed

## UUID Strategy

Both registries and collections get stable UUIDs assigned by the config layer:

- **RegistryInfo.id** — matched by `folderId` across refreshes via `mergeRegistries()`
- **CollectionInfo.id** — matched by `folderId` across refreshes via `mergeCollections()`

UUIDs are used for cache paths (`~/.skillssync/cache/<uuid>/`) so they remain stable even if names or backends change.

## Commands

### Registry management
```bash
skillsync registry create                    # create local registry (default)
skillsync registry create --backend gdrive   # create registry in Google Drive
skillsync registry list                      # show all registries and their collections
skillsync registry discover --backend gdrive # search a backend for registries
skillsync registry add-collection <name>     # add a collection reference to registry
skillsync registry push --backend gdrive     # push local registry + collections to Drive
```

### Typical workflows

**New user (local only):**
```bash
skillsync install                            # install skillsync skill for agents
skillsync add ./my_skill                     # adds to local collection
skillsync fetch my_skill --agent claude      # installs via symlink
```

**Connecting to Google Drive later:**
```bash
skillsync setup google                       # one-time setup
skillsync registry push --backend gdrive     # uploads everything to Drive
```

**Team sharing:**
```bash
skillsync registry discover --backend gdrive # find shared registries
skillsync refresh                            # update local cache
skillsync search <query>                     # search across all collections
```

## Backwards Compatibility

| Scenario | Behavior |
|---|---|
| Old `SKILLS_SYNC.yaml` | Discovered and read normally |
| No registry exists | Direct collection scan (Phase 2 only) |
| Config missing `registries` field | Backfilled to `[]` |
| Mix of local + remote collections | Both appear in unified skill list |
