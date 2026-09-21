import { scenarioStory } from "../storyTools.js";

export default { title: "03 Game board/Turn states" };

export const CheckingCardsHost = scenarioStory("board", "checkingCardsHost", "Checking cards · host");
export const CheckingCardsGuest = scenarioStory("board", "checkingCardsGuest", "Checking cards · guest");
export const ChildhoodStep = scenarioStory("board", "childhoodStep", "Childhood · step forward");
export const DiceTurn = scenarioStory("board", "diceTurn", "Player's dice turn");
export const OtherPlayerTurn = scenarioStory("board", "otherPlayerTurn", "Another player's turn");
export const DisconnectedTurn = scenarioStory("board", "disconnectedTurn", "Current player disconnected");
export const MixedPlayers = scenarioStory("board", "mixedPlayers", "Finished and left players");
