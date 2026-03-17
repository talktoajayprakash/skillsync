import os from "os";
import chalk from "chalk";
import { credentialsExist } from "../config.js";
import { hasToken, getAuthClient } from "../auth.js";
import { GDriveBackend } from "../backends/gdrive.js";
import { ghInstalled, ghAuthed, ghGetLogin } from "./setup/github.js";

interface BackendStatus {
  name: string;
  loggedIn: boolean;
  identity: string;
  hint?: string;
}

async function getGdriveStatus(): Promise<BackendStatus> {
  if (!credentialsExist()) {
    return { name: "gdrive", loggedIn: false, identity: "", hint: "run: skillsmanager setup google" };
  }
  if (!hasToken()) {
    return { name: "gdrive", loggedIn: false, identity: "", hint: "run: skillsmanager setup google" };
  }
  try {
    const client = getAuthClient();
    const backend = new GDriveBackend(client);
    const email = await backend.getOwner();
    return { name: "gdrive", loggedIn: true, identity: email };
  } catch {
    return { name: "gdrive", loggedIn: false, identity: "", hint: "run: skillsmanager setup google" };
  }
}

function getGithubStatus(): BackendStatus {
  if (!ghInstalled()) {
    return { name: "github", loggedIn: false, identity: "", hint: "install gh CLI first" };
  }
  if (!ghAuthed()) {
    return { name: "github", loggedIn: false, identity: "", hint: "run: skillsmanager setup github" };
  }
  const login = ghGetLogin();
  return { name: "github", loggedIn: true, identity: login };
}

export async function statusCommand(): Promise<void> {
  const localStatus: BackendStatus = {
    name: "local",
    loggedIn: true,
    identity: os.userInfo().username,
  };

  const [gdriveStatus, githubStatus] = await Promise.all([
    getGdriveStatus(),
    Promise.resolve(getGithubStatus()),
  ]);

  const rows = [localStatus, gdriveStatus, githubStatus];

  const col1 = 8;
  const col2 = 24;

  const header = chalk.bold("Backend".padEnd(col1)) + "  " +
    chalk.bold("Status".padEnd(col2)) + "  " +
    chalk.bold("Identity");
  const divider = "─".repeat(col1) + "  " + "─".repeat(col2) + "  " + "─".repeat(30);

  console.log();
  console.log(header);
  console.log(chalk.dim(divider));

  for (const row of rows) {
    const status = row.loggedIn
      ? chalk.green("✓ logged in")
      : chalk.red("✗ not logged in");
    const identity = row.loggedIn
      ? chalk.white(row.identity)
      : chalk.dim(row.hint ?? "");

    const statusLabel = row.loggedIn ? "✓ logged in" : "✗ not logged in";
    console.log(row.name.padEnd(col1) + "  " + status + " ".repeat(Math.max(0, col2 - statusLabel.length)) + "  " + identity);
  }

  console.log();
}
