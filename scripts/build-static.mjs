import { cp, mkdir, rm } from "node:fs/promises";

const outputDir = new URL("../dist/", import.meta.url);
const files = ["index.html", "admin.html", "assets"];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const file of files) {
  await cp(new URL(`../${file}`, import.meta.url), new URL(`../dist/${file}`, import.meta.url), {
    filter: (source) => !source.endsWith(".DS_Store"),
    recursive: true
  });
}

console.log("Static files built to dist/");
