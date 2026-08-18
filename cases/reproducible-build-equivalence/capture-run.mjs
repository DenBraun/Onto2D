import process from "node:process";
import { pathToFileURL } from "node:url";
import { captureExecution } from "./src/build-fixture.mjs";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index === process.argv.length - 1) throw new Error(`Missing --${name}.`);
  return process.argv[index + 1];
}

export async function run() {
  const allowed = new Set(["--execution-id", "--parameter-set"]);
  for (let index = 2; index < process.argv.length; index += 2) {
    if (!allowed.has(process.argv[index]) || process.argv[index + 1] === undefined) throw new Error(`Unknown or incomplete argument ${process.argv[index]}.`);
  }
  const record = await captureExecution({
    executionId: argument("execution-id"),
    parameterSet: argument("parameter-set")
  });
  process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
  return record;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
