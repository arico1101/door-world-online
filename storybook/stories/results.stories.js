import { scenarioStory } from "../storyTools.js";

export default { title: "11 Results/End of game" };

export const Solo = scenarioStory("results", "solo", "Solo result");
export const Multiplayer = scenarioStory("results", "multiplayer", "Multiplayer standings");
export const UnpaidLoan = scenarioStory("results", "unpaidLoan", "Unpaid scholarship balance");
export const PlayerLeft = scenarioStory("results", "playerLeft", "Player left before the end");
