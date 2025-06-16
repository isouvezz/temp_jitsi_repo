import ReducerRegistry from "../redux/ReducerRegistry";

import { SET_LAST_N, SET_SPEAKER_TAG } from "./actionTypes";

export interface ILastNState {
    lastN: number;
    forceChangeLastN: boolean;
    speakerId?: string;
}

const DEFAULT_STATE: ILastNState = {
    lastN: -1,
    forceChangeLastN: false,
};

ReducerRegistry.register<ILastNState>("features/base/lastn", (state = DEFAULT_STATE, action): ILastNState => {
    switch (action.type) {
        case SET_LAST_N: {
            const { lastN } = action;

            return {
                ...state,
                lastN,
                forceChangeLastN: action.forceChangeLastN ?? false,
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
