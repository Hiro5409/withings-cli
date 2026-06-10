if (process.argv.includes("--no-color")) process.env.NO_COLOR = "1";

try {
  const { main } = await import("./cli.js");
  await main();
} catch (e) {
  const { errorExitCode, formatFromArgv, printError, wasErrorPrinted } =
    await import("./error-output.js");

  if (wasErrorPrinted(e)) {
    process.exitCode = errorExitCode(e);
  } else {
    process.exitCode = printError(e, formatFromArgv(process.argv.slice(2)));
  }
}

export {};
