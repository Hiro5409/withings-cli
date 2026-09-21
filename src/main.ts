if (process.argv.includes("--no-color")) process.env.NO_COLOR = "1";

try {
  const { main } = await import("./cli.js");
  await main();
} catch (e) {
  const { formatFromArgv, printError } = await import("./error-output.js");
  process.exitCode = printError(e, formatFromArgv(process.argv.slice(2)));
}
