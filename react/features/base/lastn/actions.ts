import { SET_LAST_N, SET_SPEAKER_TAG } from "./actionTypes";

/**
 * Sets the last-n, i.e., the number of remote videos to be requested from the bridge for the conference.
 *
 * @param {number} lastN - The number of remote videos to be requested.
 * @returns {{
 *     type: SET_LAST_N,
 *     lastN: number
 * }}
 */
export function setLastN(lastN: number) {
    return {
        type: SET_LAST_N,
        lastN,
    };
}

/**
 * Sets the speaker tag for the conference.
 *
 * @param {string} speakerId - The ID of the speaker.
 * @returns {{
 *     type: SET_SPEAKER_TAG,
 *     speakerId: string
 * }}
 */
export function setSpeakerTag(speakerId: string) {
    return {
        type: SET_SPEAKER_TAG,
        speakerId,
    };
}
