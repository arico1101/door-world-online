import { scenarioStory } from "../storyTools.js";

export default { title: "06 Events/Information and status changes" };

export const IncomeGain = scenarioStory("information", "incomeGain", "Income · gain");
export const IncomeNoChange = scenarioStory("information", "incomeNoChange", "Income · no change");
export const Expense = scenarioStory("information", "expense", "Expense");
export const Learning = scenarioStory("information", "learning", "Learning gained");
export const EventPositive = scenarioStory("information", "eventPositive", "Event · positive effect");
export const EventNegative = scenarioStory("information", "eventNegative", "Event · negative effect");
export const TalkTogether = scenarioStory("information", "talkTogether", "Talk together");
export const NoStatusChange = scenarioStory("information", "noStatusChange", "No status change");
