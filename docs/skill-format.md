---
title: Skill Format
nav_order: 4
---

# Skill Format

A skill is a directory containing a `SKILL.md` file. That's the minimum. Everything else is optional.

```
my-skill/
├── SKILL.md          ← required
├── REFERENCE.md      ← optional: reference docs loaded on demand
└── scripts/          ← optional: scripts the agent can invoke
```

---

## SKILL.md

`SKILL.md` has two parts: YAML frontmatter (discovery metadata) and Markdown body (instructions for the agent).

```markdown
---
name: code-review
description: Opinionated code review — bugs, style, security, and test coverage
---

You are a code reviewer. When asked to review code:

1. Check for bugs and logic errors
2. Flag security issues (SQL injection, XSS, hardcoded secrets)
3. Comment on style only where it affects readability
4. Note missing test coverage for critical paths

Be direct. One issue per comment. No praise padding.
```

### Frontmatter fields

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Unique name within the collection. Used by CLI commands. |
| `description` | Yes | One-line summary. Shown in `list` and `search` results. |

The `name` field must match the directory name. Keep names lowercase with hyphens.

---

## REFERENCE.md

Heavy reference material the agent can load on demand — API docs, examples, cheat sheets. Keep `SKILL.md` concise (30–80 lines) and offload detail here.

```markdown
# Code Review Reference

## Common security issues

### SQL injection
Look for string concatenation in queries...

### Hardcoded secrets
Check for API keys, passwords, tokens in source...
```

---

## Tips for writing good skills

**Keep `SKILL.md` short.** Every line costs tokens when the skill is loaded. Target 30–50 lines. If you need more, move it to `REFERENCE.md`.

**Write for the agent, not a human.** Instructions should be direct commands, not explanations. The agent doesn't need context on why — it needs to know what to do.

**One skill, one job.** A skill that does too much is hard to find and hard to trust. `code-review` and `write-tests` should be separate skills.

**Name clearly.** `write-linkedin-post` is better than `linkedin` or `social-post`. The name is what you type in `skillsmanager fetch`.

---

## Collection index

Each collection has a `SKILLS_COLLECTION.yaml` that indexes its skills:

```yaml
name: my-skills
owner: you@example.com
skills:
  - name: code-review
    path: code-review/
    description: Opinionated code review — bugs, style, security, and test coverage
  - name: write-tests
    path: write-tests/
    description: Generates unit tests for a given function or module
```

Skills Manager maintains this file automatically when you use `skillsmanager add` or `skillsmanager update`.
