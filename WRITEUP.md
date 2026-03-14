# SkillsSync — CLI for Syncing Agent Skills Across Machines

## The Problem

Agent Skills (per the open standard at agentskills.io) are filesystem-based capability packages that live in:
- `~/.claude/skills/` — global skills, available to all projects
- `.claude/skills/` — project-scoped skills

This is powerful, but it creates a real pain point: **skills are trapped on the machine where you created them.** If you work across multiple machines, want to share skills with a team, or just want a backup, you have no native sync mechanism. You end up manually copying directories, losing track of versions, or re-writing skills from scratch.

**SkillsSync** solves this by giving you a CLI to browse your skills in remote storage and selectively fetch them into your current project's `.claude/skills/` directory.

---

## What is a Skill?

A skill is a directory under `~/.claude/skills/<skill-name>/` containing:

```
pdf-skill/
├── SKILL.md        ← required: YAML frontmatter (name, description) + instructions
├── REFERENCE.md    ← optional: reference docs Claude loads on demand
└── scripts/
    └── process.py  ← optional: scripts Claude can invoke via bash
```

The `SKILL.md` frontmatter is the discovery contract — Claude reads it at startup to know what the skill does and when to invoke it. The rest loads lazily only when needed.

---

## The Idea: SkillsSync

Two parts:

1. **`SKILLS_SYNC.yaml`** — a registry file that indexes all skills in a storage location
2. **`skillsync` CLI** — a client that agents use to discover, fetch, add, and update skills in that registry

### Core Operations

The CLI exposes three key methods:

**`get_all()`** — Read `SKILLS_SYNC.yaml` from the remote and return the full index of available skills (name, description). No files are downloaded — this is a lightweight metadata read.

```bash
skillsync list                      # show all skills in the collection
skillsync search "pdf"              # search skills by name or description
```

**`fetch_skill(name, agent)`** — Download a specific skill from remote storage into the global cache and symlink it to the calling agent's skills directory.

```bash
skillsync fetch pdf-skill --agent claude        # fetch and symlink to ~/.claude/skills/
skillsync fetch pdf-skill --agent codex         # fetch and symlink to ~/.codex/skills/
skillsync fetch pdf-skill code-review --agent claude  # fetch multiple
```

**`add_skill(path)`** — Add a new local skill to the remote collection. Reads the skill directory, uploads it to remote storage, and adds it to `SKILLS_SYNC.yaml`.

```bash
skillsync add ./my-new-skill               # add a skill from a local path
skillsync add .claude/skills/pdf-skill      # add a project skill to the collection
```

**`update_skill(name)`** — Push changes to an existing skill back to remote storage, updating both the skill files and the `SKILLS_SYNC.yaml` index.

```bash
skillsync update pdf-skill                  # update a skill in remote
skillsync update code-review                # update another skill
```

### Setup

```bash
skillsync init                              # log into GitHub/Google Drive, auto-discover registries
```

---

## The Registry: `SKILLS_SYNC.yaml`

`SKILLS_SYNC.yaml` is a **registry** — a single file that indexes all skills in a storage location. It contains metadata about the collection and an entry for every skill with its name, description, and path within that storage.

```yaml
# SKILLS_SYNC.yaml
version: 1
name: "My Skills"
description: "Personal collection of agent skills"
created: 2026-03-13

skills:
  - name: pdf-skill
    path: pdf-skill/
    description: "Process and fill PDF forms"

  - name: code-review
    path: code-review/
    description: "Opinionated code review workflow"

  - name: deploy-check
    path: deploy-check/
    description: "Pre-deploy validation checklist"

  - name: react-patterns
    path: react-patterns/
    description: "React component scaffolding"
```

**The registry is the key abstraction:**
- An agent reads this one file to discover all available skills — no directory traversal needed
- Each entry has a `path` pointing to where the skill lives in that storage
- The `skillsync` CLI keeps this registry in sync when skills are added or updated
- Skill names are globally unique within a registry (following the agentskills.io spec: lowercase, hyphens, 1-64 chars)

### Storage layout

The registry file sits alongside the skill directories in any storage system:

```
<any-storage-location>/
├── SKILLS_SYNC.yaml               ← the registry
├── pdf-skill/
│   ├── SKILL.md
│   └── REFERENCE.md
├── code-review/
│   └── SKILL.md
└── deploy-check/
    ├── SKILL.md
    └── scripts/
        └── validate.sh
```

Flat structure. Every skill is a direct child of the storage root. The `path` field in the registry points to each skill's directory.

### How it works

1. The registry (`SKILLS_SYNC.yaml`) lives in a storage backend (GitHub repo, Google Drive folder, etc.)
2. The `skillsync` CLI is the client that agents use to interact with the registry
3. Agents **discover** skills by reading the registry (`skillsync list`)
4. Agents **fetch** skills by name — the CLI uses the `path` field to locate and download the skill
5. Agents **add** new skills — the CLI uploads the skill directory and adds an entry to the registry
6. Agents **update** existing skills — the CLI uploads the changed files and updates the registry entry

**Why this matters for backends:** Backend adapters only need to implement: read file, write file, list directory, download directory. The registry handles discovery uniformly. Switching backends changes the transport, not the protocol.

---

## Automatic Registry Discovery

When the user runs `skillsync init`, the CLI logs into the user's accounts and **automatically discovers all registries** the user owns. No manual configuration of repos or folders needed.

### How discovery works

- **GitHub**: Uses `gh` auth. Queries the GitHub API for all repos owned by the authenticated user. Checks each for a `SKILLS_SYNC.yaml` at the root. Repos owned by the user or orgs they belong to are included.
- **Google Drive**: Uses OAuth2. Searches for all files named `SKILLS_SYNC.yaml` owned by the authenticated user across their Drive.

The CLI caches the discovered registry list locally. Running `skillsync refresh` re-runs discovery to pick up new registries.

### What the agent sees

The agent doesn't know or care about backends. `skillsync list` aggregates across all discovered registries into a single flat list:

```
NAME              DESCRIPTION                         SOURCE
pdf-skill         Process and fill PDF forms           github:ajay/my-skills
code-review       Opinionated code review workflow     github:myorg/team-skills
deploy-check      Pre-deploy validation checklist      gdrive:My Agent Skills
```

`skillsync fetch pdf-skill --agent claude` — the CLI knows which registry owns `pdf-skill` and fetches it from the right backend. The agent just uses the name.

### Init flow

```bash
skillsync init
```

```
GitHub...
  ✓ Authenticated as ajay (via gh auth)
  ✓ Found 2 registries:
    github:ajay/my-skills           (4 skills)
    github:myorg/team-skills        (12 skills)

Google Drive...
  ✗ No credentials found at ~/.skillssync/credentials.json
    To set up Google Drive:
    1. Go to https://console.cloud.google.com/
    2. Create a project → Enable Google Drive API
    3. Create OAuth credentials (Desktop app) → Download JSON
    4. Save as ~/.skillssync/credentials.json
    5. Run `skillsync init` again
    Skipping Google Drive for now.

16 skills available across 2 registries.

Run `skillsync list` to browse all available skills.
```

On subsequent run after adding credentials:

```
skills init
```

```
GitHub...
  ✓ Authenticated as ajay (via gh auth)
  ✓ Found 2 registries (cached)

Google Drive...
  ✓ Credentials found. Opening browser for consent...
  ✓ Authenticated
  ✓ Found 1 registry:
    gdrive:My Agent Skills          (3 skills)

19 skills available across 3 registries.
```

---

## Storage Backends

Backends are transport mechanisms. Each one just needs to know how to read/write files alongside a `SKILLS_SYNC.yaml`. The CLI abstracts the backend away from the agent entirely.

### GitHub (git-based)
- Each registry is a repo with `SKILLS_SYNC.yaml` at the root
- Repos are cloned to `~/.skillssync/cache/<owner>/<repo>/` on first fetch
- `skillsync list` reads from the local clone (does `git pull` to refresh)
- `skillsync fetch` creates symlinks from cache to agent directory — instant, no download needed
- `skillsync add` / `skillsync update` copies files into the clone, commits, and pushes
- Auth via existing `gh auth` — no extra credential setup
- Git gives versioning and history for free

### Google Drive
- Each registry is a folder containing `SKILLS_SYNC.yaml`
- `skillsync list` reads `SKILLS_SYNC.yaml` via a single API call
- `skillsync fetch` downloads the skill directory to `~/.skillssync/cache/gdrive/<folder-id>/<skill>/`
- `skillsync add` / `skillsync update` uploads files and updates the registry
- Auth via OAuth2 (Desktop app flow) — user creates their own Google Cloud project and OAuth credentials (one-time setup), then browser consent once, auto-refreshed after that
- Uses the `drive.file` scope (least privilege — only accesses files the app itself created) or `drive.readonly` + `drive` for discovery of existing files

**Google Drive one-time setup:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (e.g. "SkillsSync")
3. Enable the Google Drive API
4. Create OAuth 2.0 credentials → Application type: "Desktop app"
5. Download the credentials JSON and save as `~/.skillssync/credentials.json`
6. Run `skillsync init` — browser opens for consent, token is stored and auto-refreshed

### Future backends
- **S3 / R2 / MinIO** — for private cloud storage
- **Local directory / NFS** — for offline or corporate environments

---

## Configuration

Stored at `~/.skillssync/config.json` (created by `skillsync init`):

```json
{
  "registries": [
    {
      "name": "ajay/my-skills",
      "backend": "github",
      "repo": "ajay/my-skills",
      "branch": "main"
    },
    {
      "name": "myorg/team-skills",
      "backend": "github",
      "repo": "myorg/team-skills",
      "branch": "main"
    },
    {
      "name": "My Agent Skills",
      "backend": "gdrive",
      "folderId": "abc123"
    }
  ],
  "discoveredAt": "2026-03-13T00:00:00.000Z"
}
```

Auth:
- **GitHub** — uses existing `gh auth` token. No extra credential files.
- **Google Drive** — user creates their own Google Cloud project + OAuth credentials (one-time). Stored as `~/.skillssync/credentials.json` (OAuth client ID/secret) + `~/.skillssync/token.json` (access + refresh token, auto-refreshed)

The registry list is auto-populated during `skillsync init` and refreshed with `skillsync refresh`.

---

## Local Cache and Agent Symlinks

Skills are cached locally per-registry:

```
~/.skillssync/cache/
├── github/
│   ├── ajay/my-skills/              ← git clone of the repo
│   │   ├── SKILLS_SYNC.yaml
│   │   ├── pdf-skill/
│   │   └── code-review/
│   └── myorg/team-skills/           ← git clone of another repo
│       ├── SKILLS_SYNC.yaml
│       └── deploy-check/
└── gdrive/
    └── abc123/                      ← Drive folder ID
        ├── SKILLS_SYNC.yaml
        └── react-patterns/
```

When `skillsync fetch pdf-skill --agent claude` is run, the CLI:
1. Looks up which registry owns `pdf-skill` (from the cached index)
2. Locates the skill in the local cache (`~/.skillssync/cache/github/ajay/my-skills/pdf-skill/`)
3. Creates a symlink: `~/.claude/skills/pdf-skill → ~/.skillssync/cache/github/ajay/my-skills/pdf-skill/`

```
~/.claude/skills/pdf-skill       → ~/.skillssync/cache/github/ajay/my-skills/pdf-skill      (symlink)
~/.claude/skills/deploy-check    → ~/.skillssync/cache/github/myorg/team-skills/deploy-check (symlink)
~/.codex/skills/pdf-skill        → ~/.skillssync/cache/github/ajay/my-skills/pdf-skill       (symlink)
```

Benefits:
- **Single update point** — fetch once, every linked agent sees the change
- **No drift** — all agents always use the same version of a skill
- **Lightweight** — symlinks use no extra disk space
- **Multi-registry** — skills from different registries coexist without name collisions in the cache

---

## CLI Help

The CLI is primarily used by agents. The user tells the agent to use `skillsync`, and the agent runs `skillsync --help` to learn how to use it. The built-in help text should be clear and complete enough for any agent to self-serve.

Expected `skillsync --help` output:

```
SkillSync — discover, fetch, and manage agent skills from remote storage

Usage: skillsync <command> [options]

Commands:
  init                          Log into GitHub/Google Drive, auto-discover registries
  list                          Show all available skills across all registries
  search <query>                Search skills by name or description
  fetch <name> --agent <agent>  Download a skill and symlink to the agent's skills directory
  add <path>                    Add a new local skill to a registry
  update <name>                 Push changes to an existing skill back to remote
  refresh                       Re-run registry discovery to pick up new registries

Examples:
  skillsync list                          Show all available skills
  skillsync search "pdf"                  Find skills related to PDFs
  skillsync fetch pdf-skill --agent claude   Download and link to ~/.claude/skills/
  skillsync add ./my-new-skill            Upload a new skill to remote
  skillsync update code-review            Push local changes to remote

Skills are cached at ~/.skillssync/cache/ and symlinked to agent directories.
All skill names are unique — just use the name, no paths needed.
```

---

## CLI Design Principles

1. **Zero lock-in** — skills are plain Markdown files; the CLI just moves them around
2. **Pluggable backends** — add new storage adapters without breaking existing ones
3. **Agent-first** — same plain-text interface for humans and agents; `--help` is all an agent needs
4. **Composable** — works with existing tools (git, aws cli, rclone) rather than replacing them
5. **Protocol-first** — `SKILLS_SYNC.yaml` is the product; backends are swappable transport

---

## Tech Stack (MVP)

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript / Node.js | Fast iteration, good SDK support for both backends |
| CLI framework | `commander` | Lightweight, well-maintained |
| GitHub backend | `simple-git` or shell out to `git` | Clone, pull, commit, push |
| Google Drive backend | `googleapis` npm package | Official SDK, handles OAuth2 + Drive v3 |
| Terminal output | `chalk` + `ora` | Colors and spinners for a clean CLI UX |
| Config | Plain JSON files | Simple, no extra dependencies |
| Distribution | `npm link` for now, standalone binary later | Gets us testing quickly |

---

## MVP Scope

For a first working version — both GitHub and Google Drive backends:

1. `skillsync init` — log into GitHub + Google Drive, auto-discover all registries, cache index
2. `skillsync list` — aggregated list of all skills across all discovered registries
3. `skillsync search "<query>"` — search skills by name or description
4. `skillsync fetch <name> --agent <agent>` — download a skill to cache and symlink to the agent's skills directory
5. `skillsync add <path>` — add a new local skill to a registry and update its `SKILLS_SYNC.yaml`
6. `skillsync update <name>` — push changes to an existing skill and update its `SKILLS_SYNC.yaml`
7. `skillsync refresh` — re-run registry discovery to pick up new registries

**What MVP intentionally defers:**
- Conflict resolution for duplicate skill names across registries (first match wins for now)
- Publishing / sharing collections publicly

Everything deferred is additive.

---

## Summary

SkillsSync = a registry format (`SKILLS_SYNC.yaml`) + a client (`skillsync` CLI). The user logs in once with `skillsync init`, and the CLI automatically discovers all registries the user owns across GitHub and Google Drive. Agents see a single aggregated list of skills — they don't know or care which backend a skill lives in. `skillsync fetch` downloads to a local cache and symlinks to the calling agent's directory. The built-in `--help` is all an agent needs to learn the CLI.
