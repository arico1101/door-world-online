import { scenarioStory } from "../storyTools.js";

export default { title: "15 Host tools/Facilitator controls" };

export const Lobby = scenarioStory("host", "lobby", "Waiting room controls");
export const Cards = scenarioStory("host", "cards", "Card check controls");
export const Play = scenarioStory("host", "play", "In-game controls");
