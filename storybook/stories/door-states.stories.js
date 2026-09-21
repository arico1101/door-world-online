import { scenarioStory } from "../storyTools.js";

export default { title: "08 Doors/Availability and confirmation" };

export const ChoiceListMixed = scenarioStory("doorStates", "choiceListMixed", "Choice list · open, locked, unseen");
export const ChoiceListVisible = scenarioStory("doorStates", "choiceListVisible", "Choice list · visible options");
export const ConfirmOpen = scenarioStory("doorStates", "confirmOpen", "Confirm · can open");
export const ConfirmLockedMoney = scenarioStory("doorStates", "confirmLockedMoney", "Confirm · money key missing");
export const ConfirmLockedLearn = scenarioStory("doorStates", "confirmLockedLearn", "Confirm · learning key missing");
export const DiscountedMoney = scenarioStory("doorStates", "discountedMoney", "Discounted money key");
