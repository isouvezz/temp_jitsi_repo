import { SET_AUTH_TOKEN, SET_USER_ID } from "./actionTypes";

export const setAuthToken = (authToken: string | null) => ({
    type: SET_AUTH_TOKEN,
    authToken,
});

export const setUserId = (userId: string | null) => ({
    type: SET_USER_ID,
    userId,
});
