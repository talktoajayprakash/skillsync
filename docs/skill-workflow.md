# Skill Add & Fetch Workflow

Planning doc for improving the `add` and `fetch` commands to handle
skills discovered from known agent directories.

---

## Flow 1 — Add a skill from a known agent directory

**Scenario:** User creates a skill in `.claude/skills/my-skill/` or
`~/.claude/skills/my-skill/` and asks the agent to add it to the remote
collection.

### Current behavior
```bash
skillsync add ./my-skill          # user must provide exact path
```
Works, but the user (or agent) has to know the path.

### Proposed behavior
```bash
skillsync add my-skill --agent claude
```
SkillSync knows where Claude's skills live. It resolves the skill name to
a path by checking:
1. `<cwd>/.claude/skills/my-skill/`  ← project-scoped first
2. `~/.claude/skills/my-skill/`      ← then global

If found in either location, proceeds with the add. If found in both,
uses whichever is found first (project takes priority).

If not found → error:
```
Skill "my-skill" not found in .claude/skills/ or ~/.claude/skills/
```

**Collection:** defaults to first configured collection, `--collection` flag to override.

### Open questions
- [ ] If skill exists in both project and global, should we warn or silently prefer project?
- [ ] Should we walk all agent paths or only the one specified with `--agent`?

---

## Flow 2 — Fetch a skill, choose where to install it

**Scenario:** User is in a different working directory and asks the agent
to fetch a skill. The agent should clarify: install globally (available
everywhere) or locally (only in this project).

### Current behavior
```bash
skillsync fetch my-skill --agent claude
# always installs to ~/.claude/skills/ (global)
```

### Proposed behavior

Add `--scope` flag:

```bash
skillsync fetch my-skill --agent claude                   # global (default)
skillsync fetch my-skill --agent claude --scope project   # local to cwd
skillsync fetch my-skill --agent claude --scope global    # explicit global
```

**global** → symlink at `~/.claude/skills/my-skill`
**project** → symlink at `<cwd>/.claude/skills/my-skill`

For `--scope project`, create `.claude/skills/` in cwd if it doesn't exist.
This works regardless of whether the directory is a git repo.

### Agent UX guidance
When the user asks "fetch X for me" without specifying scope, the agent
should ask:
> "Should I install it globally (~/.claude/skills/) so it's available in
> all your projects, or locally (.claude/skills/) just for this project?"

Then call:
```bash
skillsync fetch my-skill --agent claude --scope global
# or
skillsync fetch my-skill --agent claude --scope project
```

### Open questions
- [ ] If `--scope project` is used but cwd has no `.claude/` dir at all,
      should we warn the user before creating it?
- [ ] Should we record what scope was used somewhere (e.g. in the symlink
      metadata or a local config) so `skillsync update` knows where to look?

---

## Summary of changes needed

### `skillsync add`
- Add `--agent <agent>` option
- When `--agent` is provided and path is just a name (no `/`), resolve it
  from the agent's known skill directories
- Existing `skillsync add <path>` behavior unchanged

### `skillsync fetch`
- Add `--scope <global|project>` option (default: `global`)
- `global` → existing behavior (`~/.agent/skills/`)
- `project` → `<cwd>/.agent/skills/`, create dir if needed

### `cache.ts`
- `createSymlink` needs to accept a `scope` + `cwd` param
- Split symlink target resolution: global uses `AGENT_PATHS`, project uses `cwd`

---

## Not in scope for now
- Detecting if a skill in the agent directory is "already synced" (no-op vs re-upload)
- Conflict resolution if remote and local have diverged
- `skillsync add --all --agent claude` (bulk add all unsynced local skills)
