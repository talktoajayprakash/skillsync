import chalk from "chalk";
import ora from "ora";
import { writeConfig } from "../config.js";
import { ensureAuth } from "../auth.js";
import { GDriveBackend } from "../backends/gdrive.js";

export async function initCommand(): Promise<void> {
  console.log(chalk.bold("\nSkillSync Init\n"));

  const auth = await ensureAuth();
  console.log(chalk.green("  ✓ Authenticated"));

  const spinner = ora("  Discovering collections...").start();
  const backend = new GDriveBackend(auth);
  const collections = await backend.discoverCollections();
  spinner.stop();

  if (collections.length === 0) {
    console.log(chalk.yellow("  No collections found."));
    console.log(chalk.dim('  Run: skillsync collection create <name>'));
  } else {
    console.log(chalk.green(`  ✓ Found ${collections.length} collection(s):`));
    for (const c of collections) {
      const col = await backend.readCollection(c);
      console.log(`    gdrive:${c.name}  (${col.skills.length} skills)`);
    }
  }

  writeConfig({ collections, discoveredAt: new Date().toISOString() });

  const totalSkills = (
    await Promise.all(collections.map((c) => backend.readCollection(c)))
  ).reduce((sum, col) => sum + col.skills.length, 0);

  console.log(`\n${totalSkills} skills across ${collections.length} collection(s).`);
  console.log(`\nRun ${chalk.bold("skillsync list")} to browse all available skills.\n`);
}
