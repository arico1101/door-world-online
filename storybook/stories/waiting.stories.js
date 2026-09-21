import { scenarioStory } from "../storyTools.js";

export default { title: "02 Waiting room/Participants" };

export const HostSolo = scenarioStory("waiting", "hostSolo", "Host · solo room");
export const HostMulti = scenarioStory("waiting", "hostMulti", "Host · players connected");
export const GuestWaiting = scenarioStory("waiting", "guestWaiting", "Guest · waiting for host");
export const HostOffline = scenarioStory("waiting", "hostOffline", "Host disconnected · claim host");
