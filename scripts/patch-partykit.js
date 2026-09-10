import fs from "fs";
import path from "path";

const binPath = path.resolve("node_modules/partykit/dist/bin.mjs");
if (fs.existsSync(binPath)) {
  let content = fs.readFileSync(binPath, "utf8");
  let modified = false;

  // Fix 1: generated.js path
  const target1 = 'fileURLToPath7(\n          path14.join(path14.dirname(import.meta.url), "../dist/generated.js")\n        )';
  const repl1 = 'path14.join(\n          path14.dirname(fileURLToPath7(import.meta.url)),\n          "../dist/generated.js"\n        )';
  if (content.includes(target1)) {
    content = content.replace(target1, repl1);
    modified = true;
  }

  // Fix 2: inject-process.js in dev
  const target2 = 'fileURLToPath7(\n            path14.join(path14.dirname(import.meta.url), "../inject-process.js")\n          )';
  const repl2 = 'path14.join(\n            path14.dirname(fileURLToPath7(import.meta.url)),\n            "../inject-process.js"\n          )';
  if (content.includes(target2)) {
    content = content.replace(target2, repl2);
    modified = true;
  }

  // Fix 3: inject-process.js in publish
  const target3 = 'fileURLToPath8(\n        path15.join(path15.dirname(import.meta.url), "../inject-process.js")\n      )';
  const repl3 = 'path15.join(\n        path15.dirname(fileURLToPath8(import.meta.url)),\n        "../inject-process.js"\n      )';
  if (content.includes(target3)) {
    content = content.replace(target3, repl3);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(binPath, content, "utf8");
    console.log("[PartyKit Patch] Windows fileURLToPath paths patched successfully.");
  }
}
