import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import YAML from "yaml";
import { readConfig } from "../config.js";
import { getAuthClient } from "../auth.js";
import { GDriveBackend } from "../backends/gdrive.js";

export async function addCommand(
  skillPath: string,
  options: { registry?: string }
): Promise<void> {
  const absPath = path.resolve(skillPath);

  // Validate the skill directory
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
    console.log(chalk.red(`"${skillPath}" is not a valid directory.`));
    return;
  }

  const skillMdPath = path.join(absPath, "SKILL.md");
  if (!fs.existsSync(skillMdPath)) {
    console.log(chalk.red(`No SKILL.md found in "${skillPath}".`));
    return;
  }

  // Parse SKILL.md frontmatter to get name and description
  const content = fs.readFileSync(skillMdPath, "utf-8");
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    console.log(chalk.red("SKILL.md is missing YAML frontmatter."));
    return;
  }

  const frontmatter = YAML.parse(frontmatterMatch[1]);
  const skillName = frontmatter.name;
  const description = frontmatter.description ?? "";

  if (!skillName) {
    console.log(chalk.red("SKILL.md frontmatter is missing 'name' field."));
    return;
  }

  const config = readConfig();
  if (config.registries.length === 0) {
    console.log(
      chalk.red("No registries configured. Run 'skillsync init' first.")
    );
    return;
  }

  // Pick registry — first one by default, or by name
  let registry = config.registries[0];
  if (options.registry) {
    const found = config.registries.find((r) => r.name === options.registry);
    if (!found) {
      console.log(chalk.red(`Registry "${options.registry}" not found.`));
      return;
    }
    registry = found;
  }

  const auth = getAuthClient();
  const backend = new GDriveBackend(auth);

  const spinner = ora(
    `Adding ${chalk.bold(skillName)} to ${registry.name}...`
  ).start();

  try {
    // Upload skill directory
    await backend.uploadSkill(registry, absPath, skillName);

    // Update registry
    const reg = await backend.readRegistry(registry);

    // Check for duplicate
    const existing = reg.skills.findIndex((s) => s.name === skillName);
    if (existing >= 0) {
      reg.skills[existing] = {
        name: skillName,
        path: `${skillName}/`,
        description,
      };
    } else {
      reg.skills.push({
        name: skillName,
        path: `${skillName}/`,
        description,
      });
    }

    await backend.writeRegistry(registry, reg);

    spinner.succeed(
      `${chalk.bold(skillName)} added to gdrive:${registry.name}`
    );
  } catch (err) {
    spinner.fail(`Failed: ${(err as Error).message}`);
  }
}
