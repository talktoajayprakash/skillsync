import chalk from "chalk";
import ora from "ora";
import { writeConfig } from "../config.js";
import { getAuthClient } from "../auth.js";
import { GDriveBackend } from "../backends/gdrive.js";

export async function refreshCommand(): Promise<void> {
  const spinner = ora("Discovering collections...").start();

  try {
    const auth = getAuthClient();
    const backend = new GDriveBackend(auth);
    const collections = await backend.discoverCollections();

    writeConfig({
      collections,
      discoveredAt: new Date().toISOString(),
    });

    spinner.stop();

    if (collections.length === 0) {
      console.log(chalk.yellow("No collections found."));
    } else {
      console.log(
        chalk.green(`Found ${collections.length} collection(s):`)
      );
      for (const c of collections) {
        console.log(`  gdrive:${c.name}`);
      }
    }

    console.log();
  } catch (err) {
    spinner.stop();
    throw err;
  }
}
