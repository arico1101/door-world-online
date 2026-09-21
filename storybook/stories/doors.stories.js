import { scenarioStory } from "../storyTools.js";

export default { title: "07 Doors/Choice content" };

export const School = scenarioStory("doors", "school", "School door");
export const HomeRural = scenarioStory("doors", "homeRural", "Home door · rural");
export const HomeUrban = scenarioStory("doors", "homeUrban", "Home door · urban");
export const UniversityOrphan = scenarioStory("doors", "universityOrphan", "University door · orphan family");
export const UniversityOther = scenarioStory("doors", "universityOther", "University door · other families");
export const TownRural = scenarioStory("doors", "townRural", "Town door · rural");
export const TownUrban = scenarioStory("doors", "townUrban", "Town door · urban");
export const Skills = scenarioStory("doors", "skills", "Skills door");
export const Career = scenarioStory("doors", "career", "Career door");
export const Learning = scenarioStory("doors", "learning", "Learning door");
