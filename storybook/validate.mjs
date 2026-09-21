import { readdir, readFile } from "node:fs/promises";
import { scenarios } from "./fixtures.js";

const storiesDir = new URL("./stories/", import.meta.url);
const files = (await readdir(storiesDir)).filter(name => name.endsWith(".stories.js"));
const refs = [];

for (const file of files) {
  const source = await readFile(new URL(file, storiesDir), "utf8");
  for (const match of source.matchAll(/scenarioStory\("([^"]+)",\s*"([^"]+)"/g)) {
    refs.push(`${match[1]}.${match[2]}`);
  }
}

const fixtureRefs = Object.entries(scenarios).flatMap(([group, entries]) =>
  Object.keys(entries).map(key => `${group}.${key}`));
const duplicateRefs = refs.filter((ref, index) => refs.indexOf(ref) !== index);
const missing = refs.filter(ref => !fixtureRefs.includes(ref));
const unused = fixtureRefs.filter(ref => !refs.includes(ref));

if (refs.length !== 73) throw new Error(`Expected 73 stories, found ${refs.length}`);
if (duplicateRefs.length) throw new Error(`Duplicate story scenarios: ${[...new Set(duplicateRefs)].join(", ")}`);
if (missing.length) throw new Error(`Missing fixtures: ${missing.join(", ")}`);
if (unused.length) throw new Error(`Unused fixtures: ${unused.join(", ")}`);

for (const [group, entries] of Object.entries(scenarios)) {
  for (const [key, scenario] of Object.entries(entries)) {
    if ((scenario.g?.players?.length || 0) > 4) {
      throw new Error(`${group}.${key} exceeds the game's four-player limit`);
    }
    const pending = scenario.g?.pending;
    if (pending?.kind === "choice" && pending.states && !pending.states.includes("open")) {
      throw new Error(`${group}.${key} contains an unreachable all-locked choice`);
    }
  }
}

console.log(`Validated ${refs.length} Storybook scenarios across ${files.length} groups.`);
