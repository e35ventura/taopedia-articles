import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const require = createRequire(import.meta.url);
const prettierPackagePath = require.resolve("prettier/package.json");
const prettierPackage = JSON.parse(await fs.readFile(prettierPackagePath, "utf8"));
const prettierBinPath =
  typeof prettierPackage.bin === "string" ? prettierPackage.bin : prettierPackage.bin?.prettier;
if (!prettierBinPath) {
  throw new Error("Unable to resolve Prettier CLI entry from package metadata");
}

const prettierBin = path.join(path.dirname(prettierPackagePath), prettierBinPath);
const prettierConfigPath = path.join(root, ".prettierrc");
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "taopedia-prettier-config-"));
const markerPath = path.join(fixtureRoot, "nested-config-executed");
const articleDir = path.join(fixtureRoot, "content", "pages", "demo");
const articlePath = path.join(articleDir, "index.mdx");
const formatProbePath = path.join(articleDir, "needs-formatting.mdx");

function childProcessOutput(error) {
  return Buffer.concat(
    [error.stdout, error.stderr].filter((chunk) => Buffer.isBuffer(chunk))
  ).toString();
}

function runPrettierCheck(filePath) {
  return execFileSync(
    process.execPath,
    [prettierBin, "--check", "--config", prettierConfigPath, filePath],
    {
      cwd: root,
      stdio: "pipe",
    }
  );
}

function assertPrettierParsesMdx(filePath) {
  try {
    runPrettierCheck(filePath);
  } catch (error) {
    assert.match(
      childProcessOutput(error),
      /Code style issues found/,
      "format:check must parse MDX files and report style issues for the probe file"
    );
    return;
  }

  throw new Error("format:check unexpectedly accepted an intentionally unformatted MDX file");
}

try {
  await fs.mkdir(articleDir, { recursive: true });
  await fs.writeFile(articlePath, "# Demo\n");
  await fs.writeFile(formatProbePath, '# Demo\n\n<Demo   prop="value" />\n');
  await fs.writeFile(
    path.join(articleDir, ".prettierrc.js"),
    `require("node:fs").writeFileSync(${JSON.stringify(markerPath)}, "executed");\nmodule.exports = {};\n`
  );

  assertPrettierParsesMdx(formatProbePath);

  try {
    runPrettierCheck(articlePath);
  } catch (error) {
    throw new Error(
      `prettier check failed before config-safety assertion:\n${childProcessOutput(error)}`
    );
  }

  await assert.rejects(
    () => fs.access(markerPath),
    /ENOENT/,
    "format:check must not execute nested Prettier config files"
  );
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}

console.log("Prettier config safety check passed");
