import chalk from "chalk";
import ora from "ora";
import { getAuthClient } from "../auth.js";
import { GDriveBackend } from "../backends/gdrive.js";
import { getCachePath, createSymlink, ensureCachePath } from "../cache.js";
import { getAllSkills } from "./list.js";

export async function fetchCommand(
  names: string[],
  options: { agent: string }
): Promise<void> {
  if (names.length === 0) {
    console.log(chalk.red("Please specify at least one skill name."));
    console.log(
      chalk.dim('  Example: skillsync fetch pdf-skill --agent claude')
    );
    return;
  }

  if (!options.agent) {
    console.log(chalk.red("Please specify an agent with --agent."));
    console.log(
      chalk.dim('  Example: skillsync fetch pdf-skill --agent claude')
    );
    return;
  }

  const allSkills = await getAllSkills();
  const auth = getAuthClient();
  const backend = new GDriveBackend(auth);

  for (const name of names) {
    const match = allSkills.find((s) => s.entry.name === name);
    if (!match) {
      console.log(chalk.red(`Skill "${name}" not found in any collection.`));
      continue;
    }

    const spinner = ora(`Fetching ${chalk.bold(name)}...`).start();

    try {
      ensureCachePath(match.collection);
      const cachePath = getCachePath(match.collection, name);

      await backend.downloadSkill(match.collection, name, cachePath);
      createSymlink(name, cachePath, options.agent);

      spinner.succeed(
        `${chalk.bold(name)} → symlinked to ${options.agent}`
      );
    } catch (err) {
      spinner.fail(`${chalk.bold(name)}: ${(err as Error).message}`);
    }
  }
}
