import { scenarioStory } from "../storyTools.js";

export default { title: "05 Family card/Family variants" };

export const Western = scenarioStory("family", "western", "Western family");
export const Japan = scenarioStory("family", "japan", "Japanese family");
export const Uganda = scenarioStory("family", "uganda", "Ugandan family");
export const Expat = scenarioStory("family", "expat", "Expat family in Uganda");
export const OrphanWithSupport = scenarioStory("family", "orphanWithSupport", "Orphan family · support known");
export const OrphanWithoutSupport = scenarioStory("family", "orphanWithoutSupport", "Orphan family · support unknown");
export const WaitingForOthers = scenarioStory("family", "waitingForOthers", "Waiting for others to check cards");
export const CardReview = scenarioStory("family", "cardReview", "Review my card during play");
