import { spawn } from "node:child_process";

const port = process.env.PORT ?? "3000";

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "start", "--hostname", "0.0.0.0", "--port", port],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
