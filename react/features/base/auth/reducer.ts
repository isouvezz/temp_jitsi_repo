import { SET_AUTH_TOKEN, SET_USER_ID } from "./actionTypes";
import ReducerRegistry from "../redux/ReducerRegistry";
import PersistenceRegistry from "../redux/PersistenceRegistry";
import logger from "../redux/logger";

export interface IAuthState {
    authToken: string | null;
    userId: string | null;
}

const DEFAULT_STATE: IAuthState = {
    authToken: null,
    userId: null,
};

const STORE_NAME = "features/base/auth";

// 상태를 영구적으로 저장하도록 등록
PersistenceRegistry.register(STORE_NAME, {
    authToken: true,
    userId: true,
});

ReducerRegistry.register<IAuthState>(STORE_NAME, (state = DEFAULT_STATE, action: any) => {
    switch (action.type) {
        case SET_AUTH_TOKEN:
            logger.info("[Auth Reducer] Setting authToken:", action.authToken);
            return {
                ...state,
                authToken: action.authToken,
            };
        case SET_USER_ID:
            logger.info("[Auth Reducer] Setting userId:", action.userId);
            return {
                ...state,
                userId: action.userId,
            };
        default:
            return state;
    }
});
