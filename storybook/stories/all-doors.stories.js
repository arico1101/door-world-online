import { scenarioStory } from "../storyTools.js";

export default { title: "13 All doors/Combined history" };

export const PlayerChoices = scenarioStory("allDoors", "playerChoices", "Choices by each player");
export const Untrodden = scenarioStory("allDoors", "untrodden", "Untrodden door variants");
