import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import YAML from "yaml";
import path from "path";
import { getAuthClient } from "../auth.js";
import { GDriveBackend } from "../backends/gdrive.js";
import { getCachePath } from "../cache.js";
import { getAllSkills } from "./list.js";

export async function updateCommand(name: string): Promise<void> {
  const allSkills = await getAllSkills();
  const match = allSkills.find((s) => s.entry.name === name);

  if (!match) {
    console.log(chalk.red(`Skill "${name}" not found in any collection.`));
    return;
  }

  const cachePath = getCachePath(match.collection, name);
  if (!fs.existsSync(cachePath)) {
    console.log(
      chalk.red(
        `Skill "${name}" not found in local cache. Fetch it first with "skillsync fetch ${name} --agent <agent>".`
      )
    );
    return;
  }

  const auth = getAuthClient();
  const backend = new GDriveBackend(auth);

  const spinner = ora(
    `Updating ${chalk.bold(name)} in gdrive:${match.collection.name}...`
  ).start();

  try {
    await backend.uploadSkill(match.collection, cachePath, name);

    const skillMdPath = path.join(cachePath, "SKILL.md");
    if (fs.existsSync(skillMdPath)) {
      const content = fs.readFileSync(skillMdPath, "utf-8");
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = YAML.parse(frontmatterMatch[1]);
        if (frontmatter.description) {
          const col = await backend.readCollection(match.collection);
          const entry = col.skills.find((s) => s.name === name);
          if (entry) {
            entry.description = frontmatter.description;
            await backend.writeCollection(match.collection, col);
          }
        }
      }
    }

    spinner.succeed(
      `${chalk.bold(name)} updated in gdrive:${match.collection.name}`
    );
  } catch (err) {
    spinner.fail(`Failed: ${(err as Error).message}`);
  }
}
