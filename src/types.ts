import os from "os";
import path from "path";

export interface SkillEntry {
  name: string;
  path: string;
  description: string;
}

export interface RegistryFile {
  name: string;
  owner: string;
  skills: SkillEntry[];
}

export interface RegistryInfo {
  name: string;
  backend: "gdrive";
  folderId: string;
  registryFileId?: string; // Drive file ID of SKILLS_SYNC.yaml
}

export interface Config {
  registries: RegistryInfo[];
  discoveredAt: string;
}

// Resolved skill = skill entry + which registry it came from
export interface ResolvedSkill {
  entry: SkillEntry;
  registry: RegistryInfo;
}

// Agent name → user-level skills directory path
export const AGENT_PATHS: Record<string, string> = {
  claude: path.join(os.homedir(), ".claude", "skills"),
  codex: path.join(os.homedir(), ".codex", "skills"),
  agents: path.join(os.homedir(), ".agents", "skills"),
  cursor: path.join(os.homedir(), ".cursor", "skills"),
  windsurf: path.join(os.homedir(), ".codeium", "windsurf", "skills"),
  copilot: path.join(os.homedir(), ".copilot", "skills"),
  gemini: path.join(os.homedir(), ".gemini", "skills"),
  roo: path.join(os.homedir(), ".roo", "skills"),
};
