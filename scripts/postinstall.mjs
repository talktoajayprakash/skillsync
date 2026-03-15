#!/usr/bin/env node

// Postinstall script — symlinks the bundled skillsync skill into every
// supported agent's global skills directory. Uses no dependencies.

import fs from "fs";
import path from "path";
import os from "os";

const home = os.homedir();

// Duplicated from src/types.ts — intentional. Postinstall must work without
// compiled TypeScript output (dist/).
const AGENT_PATHS = {
  claude:   path.join(home, ".claude", "skills"),
  codex:    path.join(home, ".codex", "skills"),
  agents:   path.join(home, ".agents", "skills"),
  cursor:   path.join(home, ".cursor", "skills"),
  windsurf: path.join(home, ".codeium", "windsurf", "skills"),
  copilot:  path.join(home, ".copilot", "skills"),
  gemini:   path.join(home, ".gemini", "skills"),
  roo:      path.join(home, ".roo", "skills"),
};

const skillSource = path.resolve(import.meta.dirname, "..", "skills", "skillsync");

if (!fs.existsSync(skillSource)) {
  // Skill directory missing from package — nothing to do
  process.exit(0);
}

// Allow override via env var: SKILLSYNC_SKILL_PATH=/custom/dir
const customPath = process.env.SKILLSYNC_SKILL_PATH;
const targets = customPath
  ? { custom: customPath }
  : AGENT_PATHS;

for (const [agent, skillsDir] of Object.entries(targets)) {
  try {
    fs.mkdirSync(skillsDir, { recursive: true });
    const linkPath = path.join(skillsDir, "skillsync");

    if (fs.existsSync(linkPath)) {
      const stat = fs.lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        fs.unlinkSync(linkPath);
      } else {
        // Don't clobber user files
        process.stderr.write(`  skillsync: skipping ${agent} — ${linkPath} exists and is not a symlink\n`);
        continue;
      }
    }

    fs.symlinkSync(skillSource, linkPath);
    process.stderr.write(`  skillsync: installed skill for ${agent} → ${linkPath}\n`);
  } catch {
    // Never fail the install
  }
}
