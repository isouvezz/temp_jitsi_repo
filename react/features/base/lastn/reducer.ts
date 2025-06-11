import ReducerRegistry from "../redux/ReducerRegistry";

import { SET_LAST_N, SET_SPEAKER_TAG } from "./actionTypes";

export interface ILastNState {
    lastN?: number;
    speakerId?: string;
}

ReducerRegistry.register<ILastNState>("features/base/lastn", (state = {}, action): ILastNState => {
    switch (action.type) {
        case SET_LAST_N: {
            const { lastN } = action;

            return {
                ...state,
                lastN,
            };
        }
        case SET_SPEAKER_TAG: {
            const { speakerId } = action;

            return {
                ...state,
                speakerId,
            };
        }
    }

    return state;
});
