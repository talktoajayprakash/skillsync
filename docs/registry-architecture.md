# Registry Architecture

## Design Principles

1. **Agent-first** — all commands are non-interactive and designed for agent use. No human uses the CLI manually.
2. **Local-first** — everything works offline with zero setup. Remote storage is opt-in.
3. **Single source of truth** — the registry is the canonical index. Collections must be accessible via the registry's backend.
4. **All-or-nothing push** — `registry push` is transactional. Either everything is pushed to remote or nothing changes.

## Overview

Skills Manager uses a two-tier architecture for organizing skills:

```
SKILLS_REGISTRY.yaml          ← root index (points to all collections)
├── Collection A/
│   ├── SKILLS_COLLECTION.yaml
│   ├── skill_1/
│   └── skill_2/
├── Collection B/
│   ├── SKILLS_COLLECTION.yaml
│   └── skill_3/
└── ...
```

A **registry** is the root node. It lists all **collections** the user has access to.

A **collection** is a folder containing skills, indexed by a `SKILLS_COLLECTION.yaml` file.

## Registry Scoping Rules

A registry's collection references must be resolvable by anyone who can read the registry:

| Registry location | Can point to | Cannot point to |
|---|---|---|
| **Local** (`~/.skillsmanager/`) | Local collections, remote collections | — |
| **Remote** (Google Drive, etc.) | Remote collections only | Local collections |

**Why:** A remote registry pointing to `backend: local` is broken by design — another machine reading the registry has no way to resolve a local path. Local files can also be deleted or modified outside of skillsmanager, making the reference unreliable.

**Enforcement:** When `registry push` migrates a local registry to a remote backend, it uploads all `backend: local` collections to the target backend and updates the refs from `backend: local` → `backend: gdrive`. No local refs survive in the remote registry.

## File Formats

### SKILLS_REGISTRY.yaml

```yaml
name: ajay-skills
owner: ajay@example.com
source: local                         # where this registry lives
collections:
  - name: my_skills
    backend: local                    # stored locally (only valid in local registries)
    ref: my_skills                    # directory name under ~/.skillsmanager/collections/
  - name: team_prompts
    backend: gdrive                   # stored in Google Drive
    ref: SKILLS_TEAM_PROMPTS       # Drive folder name
```

The `owner` field is set by the backend's `getOwner()` method:
- **Local**: `$USER` environment variable, or read from existing registry
- **Google Drive**: authenticated user's email from OAuth
- **Future backends**: username or identity from the backend's auth system

When a local registry is pushed to Google Drive, the owner is updated to the authenticated user's email.

### SKILLS_COLLECTION.yaml

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

### StorageBackend Interface

Every backend implements:

```
Identity:     getOwner()
Collections:  discoverCollections, readCollection, writeCollection, downloadSkill, uploadSkill
Registry:     discoverRegistries, readRegistry, writeRegistry, resolveCollectionRef, createRegistry
```

### Local (default)

No setup required. Everything stored under `~/.skillsmanager/`:

```
~/.skillsmanager/
├── config.json              ← cached config (registries, collections, skills index)
├── registry.yaml            ← local registry (SKILLS_REGISTRY.yaml)
├── collections/
│   └── my_skills/
│       ├── SKILLS_COLLECTION.yaml
│       └── write_linkedin_post/
│           └── SKILL.md
└── cache/                   ← cache for remote skills (symlinks point here)
```

### Google Drive

Requires `skillsmanager setup google` first (human-only, one-time). Registry and collections are stored as Drive folders.

```
Google Drive:
├── SKILLS_REGISTRY/
│   └── SKILLS_REGISTRY.yaml
├── SKILLS_MY_SKILLS/
│   ├── SKILLS_COLLECTION.yaml
│   └── write_linkedin_post/
│       └── SKILL.md
└── ...
```

Discovery searches for `SKILLS_REGISTRY.yaml` files where `'me' in owners` — each user sees only their own registries.

## Discovery Flow

When skillsmanager needs to find skills, it follows a two-phase process:

### Phase 1: Registry path
1. Search for `SKILLS_REGISTRY.yaml` files owned by the current user
2. Read each registry → get collection references
3. Resolve each reference to a concrete collection via `resolveCollectionRef()`
4. No scanning needed — the registry tells you exactly where collections are

### Phase 2: Orphan fallback
1. Scan for `SKILLS_COLLECTION.yaml` (or legacy `SKILLS_SYNC.yaml`) directly
2. Any collections found that aren't already known from Phase 1 are added
3. This ensures backwards compatibility with collections created before the registry existed
4. Over time, once all collections are in a registry, this phase finds nothing new

## Transactional Push

`skillsmanager registry push --backend gdrive` is all-or-nothing:

### Phase 1: Upload (no state changes)
1. Authenticate with Google Drive
2. Create or find the gdrive registry
3. For each `backend: local` collection in the local registry:
   - Create a Drive folder (`SKILLS_<NAME>`)
   - Upload all skills to the folder
   - Write `SKILLS_COLLECTION.yaml` to the folder
4. Accumulate results in memory — no config or registry writes yet
5. **If any upload fails → abort. Local state is completely untouched.**

### Phase 2: Commit (only after all uploads succeed)
1. Write all new collection refs to the Drive registry in a single `writeRegistry()` call
2. Update local `config.json` with the new gdrive collections and registry
3. Print success summary

**Why transactional:** A partial push leaves the system in an inconsistent state — some collections on Drive, some still local, registry partially updated. The user would need to manually clean up. All-or-nothing means the user can safely retry on failure.

## UUID Strategy

Both registries and collections get stable UUIDs assigned by the config layer:

- **RegistryInfo.id** — matched by `folderId` across refreshes via `mergeRegistries()`
- **CollectionInfo.id** — matched by `folderId` across refreshes via `mergeCollections()`

UUIDs are used for cache paths (`~/.skillsmanager/cache/<uuid>/`) so they remain stable even if names or backends change. They are never shared across machines — each machine assigns its own UUIDs.

## Commands

### Registry management
```bash
skillsmanager registry create                    # create local registry (default)
skillsmanager registry create --backend gdrive   # create registry in Google Drive
skillsmanager registry list                      # show all registries and their collections
skillsmanager registry discover --backend gdrive # search a backend for registries
skillsmanager registry add-collection <name>     # add a collection reference to registry
skillsmanager registry push --backend gdrive     # push local registry + collections to Drive
```

### Typical workflows

**New user (local only):**
```bash
skillsmanager install                            # install skillsmanager skill for agents
skillsmanager add ./my_skill                     # adds to local collection
skillsmanager fetch my_skill --agent claude      # installs via symlink
```

**Connecting to Google Drive later:**
```bash
skillsmanager setup google                       # one-time setup (human-only)
skillsmanager registry push --backend gdrive     # uploads everything to Drive
```

**Team sharing:**
```bash
skillsmanager registry discover --backend gdrive # find shared registries
skillsmanager refresh                            # update local cache
skillsmanager search <query>                     # search across all collections
```

## Backwards Compatibility

| Scenario | Behavior |
|---|---|
| Old `SKILLS_SYNC.yaml` | Discovered and read normally |
| No registry exists | Direct collection scan (Phase 2 only) |
| Config missing `registries` field | Backfilled to `[]` |
| Mix of local + remote collections | Both appear in unified skill list |
| Remote registry with `backend: local` refs | Should not exist — `registry push` prevents this |

## References

### Agent Skills Standard

- [Agent Skills Open Standard](https://agentskills.io/home) — the open format for giving agents new capabilities
- [Specification](https://agentskills.io/specification) — complete SKILL.md format specification
- [Example skills](https://github.com/anthropics/skills) — official example skills
- [Reference library](https://github.com/agentskills/agentskills/tree/main/skills-ref) — validate skills and generate prompt XML

### Agent-Specific Skills Documentation

| Agent | Skills Docs | Source |
|---|---|---|
| Claude Code | [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) | |
| Claude | [platform.claude.com/docs/en/agents-and-tools/agent-skills/overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) | |
| OpenAI Codex | [developers.openai.com/codex/skills](https://developers.openai.com/codex/skills/) | [GitHub](https://github.com/openai/codex) |
| Cursor | [cursor.com/docs/context/skills](https://cursor.com/docs/context/skills) | |
| GitHub Copilot | [docs.github.com/en/copilot/concepts/agents/about-agent-skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) | [GitHub](https://github.com/microsoft/vscode-copilot-chat) |
| VS Code | [code.visualstudio.com/docs/copilot/customization/agent-skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills) | [GitHub](https://github.com/microsoft/vscode) |
| Gemini CLI | [geminicli.com/docs/cli/skills](https://geminicli.com/docs/cli/skills/) | [GitHub](https://github.com/google-gemini/gemini-cli) |
| Antigravity | [antigravity.google/docs/get-started](https://antigravity.google/docs/get-started) | |
| OpenClaw | [docs.openclaw.ai/tools/skills](https://docs.openclaw.ai/tools/skills.md) | |
| Roo Code | [docs.roocode.com/features/skills](https://docs.roocode.com/features/skills) | [GitHub](https://github.com/RooCodeInc/Roo-Code) |
| Windsurf | [codeium.com](https://codeium.com) | |
| Goose | [block.github.io/goose/docs/guides/context-engineering/using-skills](https://block.github.io/goose/docs/guides/context-engineering/using-skills/) | [GitHub](https://github.com/block/goose) |
| JetBrains Junie | [junie.jetbrains.com/docs/agent-skills](https://junie.jetbrains.com/docs/agent-skills.html) | |
| Amp | [ampcode.com/manual#agent-skills](https://ampcode.com/manual#agent-skills) | |
| Databricks | [docs.snowflake.com/en/user-guide/cortex-code/extensibility](https://docs.databricks.com/aws/en/assistant/skills) | |

### Supported Agent Skill Directories

| Agent | Global path |
|---|---|
| claude | `~/.claude/skills/` |
| codex | `~/.codex/skills/` |
| agents | `~/.agents/skills/` |
| cursor | `~/.cursor/skills/` |
| windsurf | `~/.codeium/windsurf/skills/` |
| copilot | `~/.copilot/skills/` |
| gemini | `~/.gemini/skills/` |
| roo | `~/.roo/skills/` |
| openclaw | `~/.openclaw/skills/` |
| antigravity | `~/.gemini/antigravity/skills/` |
