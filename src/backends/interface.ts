import type { CollectionFile, CollectionInfo } from "../types.js";

export interface StorageBackend {
  discoverCollections(): Promise<Omit<CollectionInfo, "id">[]>;
  readCollection(collection: CollectionInfo): Promise<CollectionFile>;
  writeCollection(collection: CollectionInfo, data: CollectionFile): Promise<void>;
  downloadSkill(
    collection: CollectionInfo,
    skillName: string,
    destDir: string
  ): Promise<void>;
  uploadSkill(
    collection: CollectionInfo,
    localPath: string,
    skillName: string
  ): Promise<void>;
}
