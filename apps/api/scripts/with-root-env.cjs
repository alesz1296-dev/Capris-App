const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const apiRoot = path.resolve(__dirname, "..");
const rootEnvPath = path.join(repoRoot, ".env");

function parseEnvFile(content) {
  const entries = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

function loadRootEnv() {
  if (!fs.existsSync(rootEnvPath)) {
    return {};
  }

  return parseEnvFile(fs.readFileSync(rootEnvPath, "utf8"));
}

const command = process.argv[2];
const args = process.argv.slice(3);

if (!command) {
  console.error("Usage: node apps/api/scripts/with-root-env.cjs <command> [args...]");
  process.exit(1);
}

const loadedEnv = loadRootEnv();
const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") ?? "PATH";
const existingPath = process.env[pathKey] ?? "";
const extraBinPaths = [
  path.join(apiRoot, "node_modules", ".bin"),
  path.join(repoRoot, "node_modules", ".bin")
];
const childEnv = {
  ...process.env,
  ...loadedEnv,
  [pathKey]: `${extraBinPaths.join(path.delimiter)}${existingPath ? `${path.delimiter}${existingPath}` : ""}`
};

const child = spawn(command, args, {
  cwd: apiRoot,
  env: childEnv,
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
