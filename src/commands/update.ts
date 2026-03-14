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
    console.log(chalk.red(`Skill "${name}" not found in any registry.`));
    return;
  }

  const cachePath = getCachePath(match.registry, name);
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
    `Updating ${chalk.bold(name)} in gdrive:${match.registry.name}...`
  ).start();

  try {
    // Upload updated files
    await backend.uploadSkill(match.registry, cachePath, name);

    // Update description in registry if SKILL.md changed
    const skillMdPath = path.join(cachePath, "SKILL.md");
    if (fs.existsSync(skillMdPath)) {
      const content = fs.readFileSync(skillMdPath, "utf-8");
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = YAML.parse(frontmatterMatch[1]);
        if (frontmatter.description) {
          const reg = await backend.readRegistry(match.registry);
          const entry = reg.skills.find((s) => s.name === name);
          if (entry) {
            entry.description = frontmatter.description;
            await backend.writeRegistry(match.registry, reg);
          }
        }
      }
    }

    spinner.succeed(
      `${chalk.bold(name)} updated in gdrive:${match.registry.name}`
    );
  } catch (err) {
    spinner.fail(`Failed: ${(err as Error).message}`);
  }
}
