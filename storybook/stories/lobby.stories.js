import { scenarioStory } from "../storyTools.js";

export default { title: "01 Lobby/Room entry" };

export const Initial = scenarioStory("lobby", "initial", "Initial");
export const NameEntered = scenarioStory("lobby", "nameEntered", "Name entered");
export const CreateError = scenarioStory("lobby", "createError", "Create room error");
export const JoinError = scenarioStory("lobby", "joinError", "Join room error");
