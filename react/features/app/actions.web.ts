// @ts-expect-error
import { API_ID } from "../../../modules/API";
import { setRoom } from "../base/conference/actions";
import { setCourseInfo } from "../base/conference/actions.any";
import { configWillLoad, setConfig } from "../base/config/actions";
import { setLocationURL } from "../base/connection/actions.web";
import { loadConfig } from "../base/lib-jitsi-meet/functions.web";
import { isEmbedded } from "../base/util/embedUtils";
import { parseURIString } from "../base/util/uri";
import { isVpaasMeeting } from "../jaas/functions";
import { clearNotifications, showNotification } from "../notifications/actions";
import { NOTIFICATION_TIMEOUT_TYPE } from "../notifications/constants";
import { isWelcomePageEnabled } from "../welcome/functions";
import { parseAndDecryptURLParams } from "../base/util/parseURLParams";
import { setAuthToken, setUserId } from "../base/auth/actions";

import {
    maybeRedirectToTokenAuthUrl,
    redirectToStaticPage,
    redirectWithStoredParams,
    reloadWithStoredParams,
} from "./actions.any";
import { getDefaultURL, getName } from "./functions.web";
import logger from "./logger";
import { IStore } from "./types";
import CryptoJS from "crypto-js";
import AES from "crypto-js/aes";

export * from "./actions.any";

/**
 * Triggers an in-app navigation to a specific route. Allows navigation to be
 * abstracted between the mobile/React Native and Web/React applications.
 *
 * @param {string|undefined} uri - The URI to which to navigate. It may be a
 * full URL with an HTTP(S) scheme, a full or partial URI with the app-specific
 * scheme, or a mere room name.
 * @returns {Function}
 */
export function appNavigate(uri?: string) {
    // alert("uri: " + uri);
    return async (dispatch: IStore["dispatch"], getState: IStore["getState"]) => {
        let location = parseURIString(uri);
        // alert("parsed location: " + JSON.stringify(location));

        // URI에서 쿼리 파라미터 추출
        const queryString = uri?.split("?")[1] || "";

        // URL 디코딩을 하지 않고 원본 값을 그대로 사용
        const authToken = queryString.split("authToken=")[1]?.split("&")[0] || "";
        const userId = queryString.split("userId=")[1]?.split("&")[0] || "";

        // If the specified location (URI) does not identify a host, use the app's
        // default.
        if (!location?.host) {
            const defaultLocation = parseURIString(getDefaultURL(getState));

            if (location) {
                location.host = defaultLocation.host;

                // FIXME Turn location's host, hostname, and port properties into
                // setters in order to reduce the risks of inconsistent state.
                location.hostname = defaultLocation.hostname;
                location.pathname = defaultLocation.pathname + location.pathname.substr(1);
                location.port = defaultLocation.port;
                location.protocol = defaultLocation.protocol;
            } else {
                location = defaultLocation;
            }
        }

        location.protocol || (location.protocol = "https:");

        const { room } = location;
        const locationURL = new URL(location.toString());

        const decryptedParams = parseAndDecryptURLParams(authToken, userId);

        if (decryptedParams.authToken) {
            dispatch(setAuthToken(decryptedParams.authToken));
        }
        if (decryptedParams.userId) {
            dispatch(setUserId(decryptedParams.userId));
        }

        // There are notifications now that gets displayed after we technically left
        // the conference, but we're still on the conference screen.
        dispatch(clearNotifications());

        dispatch(configWillLoad(locationURL, room));

        const config = await loadConfig();

        dispatch(setLocationURL(locationURL));
        dispatch(setConfig(config));

        // 코스 정보를 포함한 방명을 가져와서 설정
        dispatch(setRoom(room));
    };
}

/**
 * Check if the welcome page is enabled and redirects to it.
 * If requested show a thank you dialog before that.
 * If we have a close page enabled, redirect to it without
 * showing any other dialog.
 *
 * @param {Object} options - Used to decide which particular close page to show
 * or if close page is disabled, whether we should show the thankyou dialog.
 * @param {boolean} options.showThankYou - Whether we should
 * show thank you dialog.
 * @param {boolean} options.feedbackSubmitted - Whether feedback was submitted.
 * @returns {Function}
 */
export function maybeRedirectToWelcomePage(options: { feedbackSubmitted?: boolean; showThankYou?: boolean } = {}) {
    return (dispatch: IStore["dispatch"], getState: IStore["getState"]) => {
        const { enableClosePage } = getState()["features/base/config"];

        // if close page is enabled redirect to it, without further action
        if (enableClosePage) {
            if (isVpaasMeeting(getState())) {
                const isOpenedInIframe = isEmbedded();

                if (isOpenedInIframe) {
                    // @ts-ignore
                    window.location = "https://bootcamp.likelion.net/";
                } else {
                    dispatch(redirectToStaticPage("/"));
                }

                return;
            }

            const { jwt } = getState()["features/base/jwt"];

            let hashParam;

            // save whether current user is guest or not, and pass auth token,
            // before navigating to close page
            window.sessionStorage.setItem("guest", (!jwt).toString());
            window.sessionStorage.setItem("jwt", jwt ?? "");

            let path = "close.html";

            if (interfaceConfig.SHOW_PROMOTIONAL_CLOSE_PAGE) {
                if (Number(API_ID) === API_ID) {
                    hashParam = `#jitsi_meet_external_api_id=${API_ID}`;
                }
                path = "close3.html";
            } else if (!options.feedbackSubmitted) {
                path = "close2.html";
            }

            dispatch(redirectToStaticPage(`static/${path}`, hashParam));

            return;
        }

        // else: show thankYou dialog only if there is no feedback
        if (options.showThankYou) {
            dispatch(
                showNotification(
                    {
                        titleArguments: { appName: getName() },
                        titleKey: "dialog.thankYou",
                    },
                    NOTIFICATION_TIMEOUT_TYPE.STICKY
                )
            );
        }

        // if Welcome page is enabled redirect to welcome page after 3 sec, if
        // there is a thank you message to be shown, 0.5s otherwise.
        if (isWelcomePageEnabled(getState())) {
            // 3초 후에 창 닫기(창 열어둔 상태에서 창 닫기)
            setTimeout(
                () => {
                    if (window.opener) {
                        window.close();
                    }
                    // else {
                    //     window.location.href = "https://bootcamp.likelion.net/";
                    // }
                },
                options.showThankYou ? 3000 : 500
            );
        }
    };
}

/**
 * Reloads the page.
 *
 * @protected
 * @returns {Function}
 */
export function reloadNow() {
    return (dispatch: IStore["dispatch"], getState: IStore["getState"]) => {
        const state = getState();
        const { locationURL } = state["features/base/connection"];

        const reloadAction = () => {
            logger.info(`Reloading the conference using URL: ${locationURL}`);

            dispatch(reloadWithStoredParams());
        };

        if (maybeRedirectToTokenAuthUrl(dispatch, getState, reloadAction)) {
            return;
        }

        reloadAction();
    };
}
