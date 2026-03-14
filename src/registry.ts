import YAML from "yaml";
import type { RegistryFile } from "./types.js";

export function parseRegistry(content: string): RegistryFile {
  const data = YAML.parse(content);
  return {
    name: data.name ?? "",
    owner: data.owner ?? "",
    skills: (data.skills ?? []).map((s: Record<string, string>) => ({
      name: s.name,
      path: s.path ?? `${s.name}/`,
      description: s.description ?? "",
    })),
  };
}

export function serializeRegistry(registry: RegistryFile): string {
  return YAML.stringify({
    name: registry.name,
    owner: registry.owner,
    skills: registry.skills.map((s) => ({
      name: s.name,
      path: s.path,
      description: s.description,
    })),
  });
}
