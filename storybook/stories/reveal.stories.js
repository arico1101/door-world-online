import { scenarioStory } from "../storyTools.js";

export default { title: "12 Reveal/Individual player" };

export const MixedDoorStates = scenarioStory("reveal", "mixedDoorStates", "Chosen, locked, and unseen doors");
export const NoDoors = scenarioStory("reveal", "noDoors", "No doors encountered");
