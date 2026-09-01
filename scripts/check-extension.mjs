import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
const runtimeFiles = await Promise.all([
  "content.js",
  "service_worker.js",
  "options.js"
].map((name) => readFile(new URL(`../extension/${name}`, import.meta.url), "utf8")));
const runtimeText = runtimeFiles.join("\n");
const manifestText = JSON.stringify(manifest);

assert.equal(manifest.name, "Reachard");
assert.ok(!manifest.permissions.includes("scripting"), "extension must not request scripting permission");
assert.ok(!`${manifestText}\n${runtimeText}`.includes("reachard.studio"), "retired .studio domain must not return");
assert.ok(manifest.host_permissions.includes("https://reachard.co/*"));
assert.ok(manifest.host_permissions.includes("https://contacts.reachard.co/*"));

for (const platform of ["greenhouse.io", "lever.co", "myworkdayjobs.com", "ashbyhq.com"]) {
  assert.ok(runtimeText.includes(platform), `missing ${platform} page support`);
}

console.log("extension static checks passed");
