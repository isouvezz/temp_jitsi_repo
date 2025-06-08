import { IReduxState } from "../app/types";

/**
 * Is noise suppression currently enabled.
 *
 * @param {IReduxState} state - The state of the application.
 * @returns {boolean}
 */
export function isLastNUnlimited(state: IReduxState): boolean {
    return state["features/base/lastn"].lastN === -1;
}

export function getLastN(state: IReduxState): number {
    return state["features/base/config"].channelLastN ?? 4;
}

export function getNumberOfVisibleTiles(state: IReduxState): number {
    return state["features/base/config"].tileView?.numberOfVisibleTiles ?? 4;
}
