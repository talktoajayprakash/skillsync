import chalk from "chalk";
import ora from "ora";
import { credentialsExist, writeConfig } from "../config.js";
import { runAuthFlow, hasToken, getAuthClient } from "../auth.js";
import { GDriveBackend } from "../backends/gdrive.js";

export async function initCommand(): Promise<void> {
  console.log(chalk.bold("\nSkillSync Init\n"));

  // Google Drive setup
  console.log("Google Drive...");

  if (!credentialsExist()) {
    console.log(
      chalk.red("  ✗ No credentials found at ~/.skillssync/credentials.json")
    );
    console.log(chalk.dim("    To set up Google Drive:"));
    console.log(
      chalk.dim("    1. Go to https://console.cloud.google.com/")
    );
    console.log(
      chalk.dim("    2. Create a project → Enable Google Drive API")
    );
    console.log(
      chalk.dim(
        "    3. Create OAuth credentials (Desktop app) → Download JSON"
      )
    );
    console.log(
      chalk.dim("    4. Save as ~/.skillssync/credentials.json")
    );
    console.log(
      chalk.dim('    5. Run "skillsync init" again')
    );
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

  const spinner = ora("  Discovering registries...").start();
  const backend = new GDriveBackend(auth);
  const registries = await backend.discoverRegistries();
  spinner.stop();

  if (registries.length === 0) {
    console.log(
      chalk.yellow(
        "  ✗ No registries found (no SKILLS_SYNC.yaml files owned by you)"
      )
    );
    console.log(
      chalk.dim(
        "    Create a folder in Google Drive with a SKILLS_SYNC.yaml file to get started."
      )
    );
  } else {
    console.log(
      chalk.green(`  ✓ Found ${registries.length} registry(ies):`)
    );
    for (const r of registries) {
      const reg = await backend.readRegistry(r);
      console.log(
        `    gdrive:${r.name}  (${reg.skills.length} skills)`
      );
    }
  }

  writeConfig({
    registries,
    discoveredAt: new Date().toISOString(),
  });

  const totalSkills = registries.length > 0
    ? (await Promise.all(registries.map((r) => backend.readRegistry(r)))).reduce(
        (sum, reg) => sum + reg.skills.length,
        0
      )
    : 0;

  console.log(
    `\n${totalSkills} skills available across ${registries.length} registry(ies).`
  );
  console.log(
    `\nRun ${chalk.bold("skillsync list")} to browse all available skills.\n`
  );
}
