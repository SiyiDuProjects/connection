import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
const runtimeFiles = await Promise.all([
  "content.js",
  "service_worker.js",
  "web_bridge.js"
].map((name) => readFile(new URL(`../extension/${name}`, import.meta.url), "utf8")));
const runtimeText = runtimeFiles.join("\n");
const manifestText = JSON.stringify(manifest);
const sessionBridge = await readFile(
  new URL("../web/components/extension-session-bridge.tsx", import.meta.url),
  "utf8"
);
const contentStyles = await readFile(
  new URL("../extension/content.css", import.meta.url),
  "utf8"
);

assert.equal(manifest.name, "Reachard");
assert.ok(!manifest.permissions.includes("scripting"), "extension must not request scripting permission");
assert.ok(!`${manifestText}\n${runtimeText}`.includes("reachard.studio"), "retired .studio domain must not return");
assert.ok(manifest.host_permissions.includes("https://reachard.co/*"));
assert.ok(manifest.host_permissions.includes("https://contacts.reachard.co/*"));
assert.equal(manifest.options_page, undefined, "extension account settings must stay on the website");
assert.ok(runtimeText.includes('class="fc-job-card"'), "home must render a job/context card");
assert.ok(runtimeText.includes('class="fc-primary-wide fc-search-button"'), "search action must be separate from the job card");
assert.ok(!runtimeText.includes('data-tab='), "extension must stay on one page without tabs");
assert.ok(!runtimeText.includes('class="fc-topbar"'), "brand must not be wrapped in a separate header");
assert.ok(runtimeText.includes('class="fc-search-sheet"'), "contact search must open in a bottom sheet");
assert.match(
  contentStyles,
  /\.fc-search-sheet-backdrop\s*\{[^}]*\binset:\s*0;/s,
  "search backdrop must dim the whole panel, including the header"
);
assert.ok(!runtimeText.includes("Ready to search"), "redundant readiness status must not return");
assert.ok(runtimeText.includes("Log In to Reachard"), "signed-out primary action must be explicit");
assert.ok(
  runtimeText.includes('const DEFAULT_LANGUAGE = "en"'),
  "extension must remain English-only"
);
assert.match(
  contentStyles,
  /\.fc-customize-inline\s*\{[^}]*\bborder:\s*1px solid #dce2ea;[^}]*\bborder-radius:\s*12px;[^}]*\bmargin-top:\s*0;/s,
  "email preferences must remain a rounded card"
);
assert.match(
  contentStyles,
  /\.fc-search-button\s*\{[^}]*\bmargin:\s*0 0 12px;/s,
  "home cards and primary action must use consistent vertical spacing"
);
assert.ok(
  runtimeText.includes('input[type="radio"][data-customize-field]'),
  "email preference controls must update immediately when selected"
);
assert.ok(
  contentStyles.includes(".fc-segment input:checked + span"),
  "checked email preferences must expose a visible selected state"
);
assert.ok(runtimeText.includes("CONTEXT_REFRESHED_ERROR"), "stale website bridge must fail gracefully");
assert.ok(
  runtimeText.includes('window.removeEventListener("message", handleMessage)'),
  "stale website bridge must stop handling requests"
);
assert.ok(sessionBridge.includes("CONNECT_EXTENSION_TOKEN"), "signed-in website must auto-connect the extension");

for (const platform of ["greenhouse.io", "lever.co", "myworkdayjobs.com", "ashbyhq.com"]) {
  assert.ok(runtimeText.includes(platform), `missing ${platform} page support`);
}

console.log("extension static checks passed");
