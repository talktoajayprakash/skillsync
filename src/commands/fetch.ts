import chalk from "chalk";
import ora from "ora";
import { getCachePath, createSymlink, ensureCachePath } from "../cache.js";
import { ensureReady } from "../ready.js";

export async function fetchCommand(
  names: string[],
  options: { agent: string }
): Promise<void> {
  if (names.length === 0) {
    console.log(chalk.red("Please specify at least one skill name."));
    console.log(chalk.dim('  Example: skillsync fetch pdf-skill --agent claude'));
    return;
  }

  if (!options.agent) {
    console.log(chalk.red("Please specify an agent with --agent."));
    console.log(chalk.dim('  Example: skillsync fetch pdf-skill --agent claude'));
    return;
  }

  const { config, backend } = await ensureReady();

  // Gather all skills across collections
  const allSkills = [];
  for (const collection of config.collections) {
    const col = await backend.readCollection(collection);
    for (const entry of col.skills) {
      allSkills.push({ entry, collection });
    }
  }

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

      spinner.succeed(`${chalk.bold(name)} → symlinked to ${options.agent}`);
    } catch (err) {
      spinner.fail(`${chalk.bold(name)}: ${(err as Error).message}`);
    }
  }
}
