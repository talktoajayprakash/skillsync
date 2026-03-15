# SkillSync — Agent Guide

SkillSync is a CLI tool for storing and fetching agent skills from local or remote storage (Google Drive).

For a full understanding of the design, decisions, and architecture read **[WRITEUP.md](./WRITEUP.md)** and **[docs/registry-architecture.md](./docs/registry-architecture.md)**.

## Quick reference

```bash
skillsync install                       # install skillsync skill to all agents
skillsync search <query>                # search by name or description (BM25)
skillsync fetch <name> --agent <agent>  # download skill and symlink to agent
skillsync add <path>                    # upload a local skill to a collection
skillsync update <path>                 # push local changes back to storage
skillsync list                          # list all available skills
skillsync refresh                       # re-discover collections
skillsync collection create             # create a new collection
skillsync registry create               # create a local registry
skillsync registry list                 # show registries and collections
skillsync registry push --backend gdrive  # push local data to Google Drive
skillsync setup google                  # one-time Google Drive setup (human-facing)
```

## Key files

| Path | Purpose |
|---|---|
| `~/.skillssync/config.json` | Cached registries, collections, skills index |
| `~/.skillssync/registry.yaml` | Local registry (SKILLSYNC_REGISTRY.yaml) |
| `~/.skillssync/collections/<name>/` | Local collection storage |
| `~/.skillssync/credentials.json` | Google OAuth client credentials |
| `~/.skillssync/token.json` | OAuth access + refresh token |
| `~/.skillssync/cache/<uuid>/<skill>/` | Downloaded skill cache |

## Source layout

```
src/
├── index.ts              # CLI entry point (commander)
├── types.ts              # Core interfaces: CollectionInfo, RegistryInfo, Config
├── config.ts             # Config read/write, mergeCollections(), mergeRegistries()
├── auth.ts               # OAuth flow, ensureAuth()
├── ready.ts              # ensureReady() — auto-auth + auto-discover
├── cache.ts              # Cache paths (by UUID), symlink creation
├── bm25.ts               # BM25 search ranking
├── registry.ts           # YAML parse/serialize for collections and registries
├── backends/
│   ├── interface.ts      # StorageBackend interface
│   ├── local.ts          # Local filesystem backend (default, no auth)
│   └── gdrive.ts         # Google Drive implementation
└── commands/
    ├── init.ts
    ├── list.ts
    ├── search.ts
    ├── fetch.ts
    ├── add.ts
    ├── update.ts
    ├── refresh.ts
    ├── collection.ts
    ├── registry.ts       # registry create/list/discover/add-collection/push
    ├── install.ts        # install/uninstall bundled skill
    └── setup/google.ts
```
