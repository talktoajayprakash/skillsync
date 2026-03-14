import chalk from "chalk";
import ora from "ora";
import { writeConfig } from "../config.js";
import { getAuthClient } from "../auth.js";
import { GDriveBackend } from "../backends/gdrive.js";

export async function refreshCommand(): Promise<void> {
  const spinner = ora("Discovering registries...").start();

  try {
    const auth = getAuthClient();
    const backend = new GDriveBackend(auth);
    const registries = await backend.discoverRegistries();

    writeConfig({
      registries,
      discoveredAt: new Date().toISOString(),
    });

    spinner.stop();

    if (registries.length === 0) {
      console.log(chalk.yellow("No registries found."));
    } else {
      console.log(
        chalk.green(`Found ${registries.length} registry(ies):`)
      );
      for (const r of registries) {
        console.log(`  gdrive:${r.name}`);
      }
    }

    console.log();
  } catch (err) {
    spinner.stop();
    throw err;
  }
}
