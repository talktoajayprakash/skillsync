import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import { readConfig, writeConfig, mergeRegistries, CONFIG_PATH } from "../config.js";
import { ensureAuth } from "../auth.js";
import { GDriveBackend } from "../backends/gdrive.js";
import { LocalBackend } from "../backends/local.js";
import type { Config, RegistryInfo } from "../types.js";

export async function registryCreateCommand(options: { backend?: string }): Promise<void> {
  const backend = options.backend ?? "local";

  if (backend === "local") {
    const local = new LocalBackend();
    const spinner = ora("Creating local registry...").start();
    try {
      const registry = await local.createRegistry();
      spinner.succeed(`Local registry created`);

      let config: Config = { registries: [], collections: [], skills: {}, discoveredAt: new Date().toISOString() };
      if (fs.existsSync(CONFIG_PATH)) {
        try { config = readConfig(); } catch { /* use default */ }
      }
      config.registries.push(registry);
      writeConfig(config);
    } catch (err) {
      spinner.fail(`Failed: ${(err as Error).message}`);
    }
  } else if (backend === "gdrive") {
    const auth = await ensureAuth();
    const gdrive = new GDriveBackend(auth);
    const spinner = ora("Creating registry in Google Drive...").start();
    try {
      const registry = await gdrive.createRegistry();
      spinner.succeed(`Registry created in Google Drive`);

      let config: Config = { registries: [], collections: [], skills: {}, discoveredAt: new Date().toISOString() };
      if (fs.existsSync(CONFIG_PATH)) {
        try { config = readConfig(); } catch { /* use default */ }
      }
      config.registries.push(registry);
      writeConfig(config);
    } catch (err) {
      spinner.fail(`Failed: ${(err as Error).message}`);
    }
  } else {
    console.log(chalk.red(`Unknown backend "${backend}". Supported: local, gdrive`));
  }
}

export async function registryListCommand(): Promise<void> {
  let config: Config;
  try { config = readConfig(); } catch {
    console.log(chalk.yellow("No config found. Run: skillsync registry create"));
    return;
  }

  if (config.registries.length === 0) {
    console.log(chalk.yellow("No registries configured."));
    console.log(chalk.dim("  Run: skillsync registry create"));
    return;
  }

  for (const reg of config.registries) {
    console.log(`\n${chalk.bold(reg.name)} ${chalk.dim(`(${reg.backend})`)}`);

    try {
      const backend = reg.backend === "gdrive"
        ? new GDriveBackend(await ensureAuth())
        : new LocalBackend();
      const data = await backend.readRegistry(reg);

      if (data.collections.length === 0) {
        console.log(chalk.dim("  No collections"));
      } else {
        for (const ref of data.collections) {
          console.log(`  ${chalk.cyan(ref.name)} ${chalk.dim(`${ref.backend}:${ref.ref}`)}`);
        }
      }
    } catch (err) {
      console.log(chalk.red(`  Error reading: ${(err as Error).message}`));
    }
  }
  console.log();
}

export async function registryDiscoverCommand(options: { backend?: string }): Promise<void> {
  const backendName = options.backend ?? "local";
  const spinner = ora(`Discovering registries in ${backendName}...`).start();

  try {
    const backend = backendName === "gdrive"
      ? new GDriveBackend(await ensureAuth())
      : new LocalBackend();

    const fresh = await backend.discoverRegistries();

    let config: Config = { registries: [], collections: [], skills: {}, discoveredAt: new Date().toISOString() };
    if (fs.existsSync(CONFIG_PATH)) {
      try { config = readConfig(); } catch { /* use default */ }
    }

    config.registries = mergeRegistries(fresh, config.registries);
    writeConfig(config);
    spinner.stop();

    if (fresh.length === 0) {
      console.log(chalk.yellow(`No registries found in ${backendName}.`));
    } else {
      console.log(chalk.green(`Found ${fresh.length} registry(ies) in ${backendName}:`));
      for (const r of fresh) {
        console.log(`  ${chalk.cyan(r.name)}`);
      }
    }
  } catch (err) {
    spinner.fail(`Failed: ${(err as Error).message}`);
  }
}

export async function registryAddCollectionCommand(
  collectionName: string,
  options: { backend?: string; ref?: string }
): Promise<void> {
  let config: Config;
  try { config = readConfig(); } catch {
    console.log(chalk.red("No config found. Run: skillsync registry create"));
    return;
  }

  if (config.registries.length === 0) {
    console.log(chalk.red("No registries configured. Run: skillsync registry create"));
    return;
  }

  // Use first registry
  const reg = config.registries[0];
  const backend = reg.backend === "gdrive"
    ? new GDriveBackend(await ensureAuth())
    : new LocalBackend();

  const data = await backend.readRegistry(reg);
  const existing = data.collections.find((c) => c.name === collectionName);
  if (existing) {
    console.log(chalk.yellow(`Collection "${collectionName}" already in registry.`));
    return;
  }

  data.collections.push({
    name: collectionName,
    backend: options.backend ?? reg.backend,
    ref: options.ref ?? collectionName,
  });

  await backend.writeRegistry(reg, data);
  console.log(chalk.green(`Added "${collectionName}" to registry "${reg.name}".`));
}

export async function registryPushCommand(options: { backend?: string }): Promise<void> {
  const targetBackend = options.backend ?? "gdrive";

  if (targetBackend !== "gdrive") {
    console.log(chalk.red(`Push to "${targetBackend}" not yet supported. Use: --backend gdrive`));
    return;
  }

  let config: Config;
  try { config = readConfig(); } catch {
    console.log(chalk.red("No config found."));
    return;
  }

  // Find local registry
  const localReg = config.registries.find((r) => r.backend === "local");
  if (!localReg) {
    console.log(chalk.yellow("No local registry to push."));
    return;
  }

  const local = new LocalBackend();
  const localData = await local.readRegistry(localReg);
  const localCollectionRefs = localData.collections.filter((c) => c.backend === "local");

  if (localCollectionRefs.length === 0) {
    console.log(chalk.yellow("No local collections to push."));
    return;
  }

  const auth = await ensureAuth();
  const gdrive = new GDriveBackend(auth);

  // Discover or create gdrive registry
  let gdriveReg = config.registries.find((r) => r.backend === "gdrive");
  if (!gdriveReg) {
    const spinner = ora("Creating registry in Google Drive...").start();
    gdriveReg = await gdrive.createRegistry();
    config.registries.push(gdriveReg);
    spinner.succeed("Created registry in Google Drive");
  }

  // Push each local collection to gdrive
  for (const ref of localCollectionRefs) {
    const spinner = ora(`Pushing collection "${ref.name}" to Google Drive...`).start();
    try {
      const collInfo = await local.resolveCollectionRef(ref);
      if (!collInfo) {
        spinner.fail(`Collection "${ref.name}" not found locally`);
        continue;
      }

      // Create the collection folder on Drive
      const PREFIX = "SKILLSYNC_";
      const folderName = `${PREFIX}${ref.name.toUpperCase()}`;
      const driveCol = await gdrive.createCollection(folderName);

      // Read local collection data and upload skills
      const colData = await local.readCollection({ ...collInfo, id: "temp" });
      for (const skill of colData.skills) {
        const localSkillPath = path.join(collInfo.folderId, skill.name);
        if (fs.existsSync(localSkillPath)) {
          await gdrive.uploadSkill(driveCol, localSkillPath, skill.name);
        }
      }
      await gdrive.writeCollection(driveCol, colData);

      // Update config with the new gdrive collection
      config.collections.push(driveCol);

      // Update the registry ref to point to gdrive
      const gdriveData = await gdrive.readRegistry(gdriveReg!);
      gdriveData.collections.push({
        name: ref.name,
        backend: "gdrive",
        ref: folderName,
      });
      await gdrive.writeRegistry(gdriveReg!, gdriveData);

      spinner.succeed(`Pushed "${ref.name}" to Google Drive`);
    } catch (err) {
      spinner.fail(`Failed to push "${ref.name}": ${(err as Error).message}`);
    }
  }

  writeConfig(config);
}

// Need path import for push command
import path from "path";
