import type { RegistryFile, RegistryInfo } from "../types.js";

export interface StorageBackend {
  discoverRegistries(): Promise<RegistryInfo[]>;
  readRegistry(registry: RegistryInfo): Promise<RegistryFile>;
  writeRegistry(registry: RegistryInfo, data: RegistryFile): Promise<void>;
  downloadSkill(
    registry: RegistryInfo,
    skillName: string,
    destDir: string
  ): Promise<void>;
  uploadSkill(
    registry: RegistryInfo,
    localPath: string,
    skillName: string
  ): Promise<void>;
}
