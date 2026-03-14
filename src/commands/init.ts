import chalk from "chalk";
import ora from "ora";
import { credentialsExist, writeConfig } from "../config.js";
import { runAuthFlow, hasToken, getAuthClient } from "../auth.js";
import { GDriveBackend } from "../backends/gdrive.js";

export async function initCommand(): Promise<void> {
  console.log(chalk.bold("\nSkillSync Init\n"));

  console.log("Google Drive...");

  if (!credentialsExist()) {
    console.log(
      chalk.red("  ✗ No credentials found at ~/.skillssync/credentials.json")
    );
    console.log(chalk.dim("    Run: skillsync setup google"));
    console.log();
    return;
  }

  let auth;
  if (hasToken()) {
    console.log(chalk.green("  ✓ Already authenticated"));
    auth = getAuthClient();
  } else {
    auth = await runAuthFlow();
    console.log(chalk.green("  ✓ Authenticated"));
  }

  const spinner = ora("  Discovering collections...").start();
  const backend = new GDriveBackend(auth);
  const collections = await backend.discoverCollections();
  spinner.stop();

  if (collections.length === 0) {
    console.log(
      chalk.yellow(
        "  ✗ No collections found (no SKILLS_SYNC.yaml files owned by you)"
      )
    );
    console.log(
      chalk.dim(
        '    Run "skillsync collection create" to create your first collection.'
      )
    );
  } else {
    console.log(
      chalk.green(`  ✓ Found ${collections.length} collection(s):`)
    );
    for (const c of collections) {
      const col = await backend.readCollection(c);
      console.log(
        `    gdrive:${c.name}  (${col.skills.length} skills)`
      );
    }
  }

  writeConfig({
    collections,
    discoveredAt: new Date().toISOString(),
  });

  const totalSkills = collections.length > 0
    ? (await Promise.all(collections.map((c) => backend.readCollection(c)))).reduce(
        (sum, col) => sum + col.skills.length,
        0
      )
    : 0;

  console.log(
    `\n${totalSkills} skills available across ${collections.length} collection(s).`
  );
  console.log(
    `\nRun ${chalk.bold("skillsync list")} to browse all available skills.\n`
  );
}
