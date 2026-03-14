import chalk from "chalk";
import ora from "ora";
import { getAllSkills } from "./list.js";

export async function searchCommand(query: string): Promise<void> {
  const spinner = ora("Searching skills...").start();

  try {
    const skills = await getAllSkills();
    spinner.stop();

    const q = query.toLowerCase();
    const matches = skills.filter(
      (s) =>
        s.entry.name.toLowerCase().includes(q) ||
        s.entry.description.toLowerCase().includes(q)
    );

    if (matches.length === 0) {
      console.log(chalk.yellow(`No skills matching "${query}".`));
      return;
    }

    const maxName = Math.max(...matches.map((s) => s.entry.name.length), 4);
    const maxDesc = Math.max(
      ...matches.map((s) => s.entry.description.length),
      11
    );

    console.log(
      `\n  ${chalk.dim("NAME".padEnd(maxName + 2))}${chalk.dim("DESCRIPTION".padEnd(maxDesc + 2))}${chalk.dim("SOURCE")}`
    );
    console.log(`  ${chalk.dim("-".repeat(maxName + maxDesc + 30))}`);

    for (const s of matches.sort((a, b) =>
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
