export function resolveNpmInvocation(
  commandArguments,
  {
    platform = process.platform,
    environment = process.env,
    nodeExecutable = process.execPath,
  } = {},
) {
  const npmCliPath = environment.npm_execpath;
  if (npmCliPath) {
    return {
      command: nodeExecutable,
      commandArguments: [npmCliPath, ...commandArguments],
    };
  }

  if (platform === "win32") {
    return {
      command: environment.ComSpec ?? environment.COMSPEC ?? "cmd.exe",
      commandArguments: ["/d", "/s", "/c", "npm.cmd", ...commandArguments],
    };
  }

  return {
    command: "npm",
    commandArguments: [...commandArguments],
  };
}
