import chalk from "chalk";
import ora from "ora";
import { readConfig } from "../config.js";
import { getAuthClient } from "../auth.js";
import { GDriveBackend } from "../backends/gdrive.js";
import type { ResolvedSkill } from "../types.js";

export async function getAllSkills(): Promise<ResolvedSkill[]> {
  const config = readConfig();
  const auth = getAuthClient();
  const backend = new GDriveBackend(auth);
  const allSkills: ResolvedSkill[] = [];

  for (const registry of config.registries) {
    const reg = await backend.readRegistry(registry);
    for (const entry of reg.skills) {
      allSkills.push({ entry, registry });
    }
  }

  return allSkills;
}

export async function listCommand(): Promise<void> {
  const spinner = ora("Fetching skills...").start();

  try {
    const skills = await getAllSkills();
    spinner.stop();

    if (skills.length === 0) {
      console.log(chalk.yellow("No skills found across any registries."));
      console.log(
        chalk.dim(
          'Run "skillsync init" to discover registries, or create a SKILLS_SYNC.yaml in Google Drive.'
        )
      );
      return;
    }

    const maxName = Math.max(...skills.map((s) => s.entry.name.length), 4);
    const maxDesc = Math.max(
      ...skills.map((s) => s.entry.description.length),
      11
    );

    console.log(
      `\n  ${chalk.dim("NAME".padEnd(maxName + 2))}${chalk.dim("DESCRIPTION".padEnd(maxDesc + 2))}${chalk.dim("SOURCE")}`
    );
    console.log(`  ${chalk.dim("-".repeat(maxName + maxDesc + 30))}`);

    for (const s of skills.sort((a, b) =>
      a.entry.name.localeCompare(b.entry.name)
    )) {
      console.log(
        `  ${chalk.cyan(s.entry.name.padEnd(maxName + 2))}${s.entry.description.padEnd(maxDesc + 2)}${chalk.dim(`gdrive:${s.registry.name}`)}`
      );
    }

    console.log();
  } catch (err) {
    spinner.stop();
    throw err;
  }
}
