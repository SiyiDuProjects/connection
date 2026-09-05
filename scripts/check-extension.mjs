import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
const runtimeFiles = await Promise.all([
  "content.js",
  "sidepanel.js",
  "sidepanel-context.js",
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
const uiSource = await readFile(new URL("../extension-ui/index.jsx", import.meta.url), "utf8");
assert.deepEqual(manifest.content_scripts[0].js, ['content.js']);
assert.ok(manifest.permissions.includes('sidePanel'));
assert.equal(manifest.side_panel.default_path, 'sidepanel.html');
assert.equal(manifest.web_accessible_resources, undefined);
assert.ok(!runtimeFiles[0].includes('createElement(\'iframe\')'));
assert.ok(!runtimeFiles[0].includes('createElement(\'aside\')'));
assert.ok(!contentStyles.includes('data-reachard-docked'));
assert.ok(runtimeFiles[0].includes('OPEN_REACHARD_SIDE_PANEL'));
assert.ok(runtimeText.includes('chrome.sidePanel.open'));
assert.ok(runtimeText.includes('chrome.sidePanel.close'));
assert.ok(!runtimeText.includes('GET_REACHARD_EMBEDDED_CONTEXT'));
assert.ok(!uiSource.includes('ep-toolbar'), "native browser header must not be duplicated inside the panel");
assert.ok(uiSource.includes("attachShadow"), "extension styles must be isolated from visited websites");
assert.ok(uiSource.includes("UNSTABLE_portalContainer={portal}"), "menus must stay inside the isolated UI");
assert.ok(uiSource.includes("isNonModal"), "menus must not hide their Shadow DOM host from accessibility");
assert.ok(uiSource.includes("Log In to Reachard"), "signed-out primary action must be explicit");
assert.ok(!/\bzh:\s*\{/.test(runtimeText), "extension must remain English-only");
assert.ok(runtimeText.includes("window.ReachardUI.render(panel, state"), "UI must render the actual extension state");
for (const action of ["search: runSearch", "reveal: revealEmail", "draft: draftEmail", "save: saveCustomizeFromPanel"]) {
  assert.ok(runtimeText.includes(action), "UI must connect to existing operation: " + action);
}
assert.ok(runtimeText.includes("if (!await saveCustomizeFromPanel())"), "drafts must use the current selected preferences");
assert.ok(!uiSource.includes("fixture-maya"), "fixture contacts must never ship in the extension UI");
assert.ok(!contentStyles.includes("#fc-linkedin-panel.fc-panel"), "webpages must not retain the old full-height overlay");
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
