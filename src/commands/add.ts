import fs from "fs";
import path from "path";
import readline from "readline";
import chalk from "chalk";
import ora from "ora";
import YAML from "yaml";
import { readConfig, writeConfig, CONFIG_PATH } from "../config.js";
import { getAuthClient } from "../auth.js";
import { GDriveBackend } from "../backends/gdrive.js";
import type { Config } from "../types.js";

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

export async function addCommand(
  skillPath: string,
  options: { collection?: string }
): Promise<void> {
  const absPath = path.resolve(skillPath);

  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
    console.log(chalk.red(`"${skillPath}" is not a valid directory.`));
    return;
  }

  const skillMdPath = path.join(absPath, "SKILL.md");
  if (!fs.existsSync(skillMdPath)) {
    console.log(chalk.red(`No SKILL.md found in "${skillPath}".`));
    return;
  }

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

  let config: Config;
  try {
    config = readConfig();
  } catch {
    config = { collections: [], discoveredAt: new Date().toISOString() };
  }

  if (config.collections.length === 0) {
    console.log(chalk.yellow("No collections found."));
    const ans = await ask(`Create a new collection in Google Drive now? ${chalk.dim("[y/n]")} `);
    if (!ans.toLowerCase().startsWith("y")) {
      console.log(chalk.dim("Run 'skillsync collection create' to set one up."));
      return;
    }
    const nameInput = await ask(`Collection name ${chalk.dim('(leave blank for "my-skills")')}: `);
    const folderName = nameInput || "my-skills";

    const auth = getAuthClient();
    const backend = new GDriveBackend(auth);
    const spinner = ora(`Creating collection "${folderName}" in Google Drive...`).start();
    try {
      const collection = await backend.createCollection(folderName);
      spinner.succeed(`Collection "${folderName}" created`);
      config.collections.push(collection);
      writeConfig(config);
    } catch (err) {
      spinner.fail(`Failed to create collection: ${(err as Error).message}`);
      return;
    }
  }

  // Pick collection — first one by default, or by name
  let collection = config.collections[0];
  if (options.collection) {
    const found = config.collections.find((c) => c.name === options.collection);
    if (!found) {
      console.log(chalk.red(`Collection "${options.collection}" not found.`));
      return;
    }
    collection = found;
  }

  const auth = getAuthClient();
  const backend = new GDriveBackend(auth);

  const spinner = ora(
    `Adding ${chalk.bold(skillName)} to ${collection.name}...`
  ).start();

  try {
    await backend.uploadSkill(collection, absPath, skillName);

    const col = await backend.readCollection(collection);

    const existing = col.skills.findIndex((s) => s.name === skillName);
    if (existing >= 0) {
      col.skills[existing] = { name: skillName, path: `${skillName}/`, description };
    } else {
      col.skills.push({ name: skillName, path: `${skillName}/`, description });
    }

    await backend.writeCollection(collection, col);

    spinner.succeed(
      `${chalk.bold(skillName)} added to gdrive:${collection.name}`
    );
  } catch (err) {
    spinner.fail(`Failed: ${(err as Error).message}`);
  }
}
