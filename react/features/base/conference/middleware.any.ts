import i18n from "i18next";
import { AnyAction } from "redux";

// @ts-ignore
import { MIN_ASSUMED_BANDWIDTH_BPS } from "../../../../modules/API/constants";
import {
    ACTION_PINNED,
    ACTION_UNPINNED,
    createNotAllowedErrorEvent,
    createOfferAnswerFailedEvent,
    createPinnedEvent,
} from "../../analytics/AnalyticsEvents";
import { sendAnalytics } from "../../analytics/functions";
import { reloadNow } from "../../app/actions";
import { IStore } from "../../app/types";
import { removeLobbyChatParticipant } from "../../chat/actions.any";
import { openDisplayNamePrompt } from "../../display-name/actions";
import { isVpaasMeeting } from "../../jaas/functions";
import { showErrorNotification, showNotification } from "../../notifications/actions";
import { NOTIFICATION_TIMEOUT_TYPE } from "../../notifications/constants";
import { INotificationProps } from "../../notifications/types";
import { hasDisplayName } from "../../prejoin/utils";
import { stopLocalVideoRecording } from "../../recording/actions.any";
import LocalRecordingManager from "../../recording/components/Recording/LocalRecordingManager";
import { iAmVisitor } from "../../visitors/functions";
import { overwriteConfig } from "../config/actions";
import { CONNECTION_ESTABLISHED, CONNECTION_FAILED } from "../connection/actionTypes";
import { connectionDisconnected, disconnect } from "../connection/actions";
import { validateJwt } from "../jwt/functions";
import { JitsiConferenceErrors, JitsiConferenceEvents, JitsiConnectionErrors } from "../lib-jitsi-meet";
import { PARTICIPANT_UPDATED, PIN_PARTICIPANT } from "../participants/actionTypes";
import { PARTICIPANT_ROLE } from "../participants/constants";
import { getLocalParticipant, getParticipantById, getPinnedParticipant } from "../participants/functions";
import MiddlewareRegistry from "../redux/MiddlewareRegistry";
import StateListenerRegistry from "../redux/StateListenerRegistry";
import { TRACK_ADDED, TRACK_REMOVED } from "../tracks/actionTypes";
import { parseURIString } from "../util/uri";

import {
    CONFERENCE_FAILED,
    CONFERENCE_JOINED,
    CONFERENCE_SUBJECT_CHANGED,
    CONFERENCE_WILL_LEAVE,
    P2P_STATUS_CHANGED,
    SEND_TONES,
    SET_ASSUMED_BANDWIDTH_BPS,
    SET_PENDING_SUBJECT_CHANGE,
    SET_ROOM,
} from "./actionTypes";
import {
    authStatusChanged,
    conferenceFailed,
    conferenceWillLeave,
    createConference,
    setLocalSubject,
    setSubject,
    updateConferenceMetadata,
} from "./actions";
import { CONFERENCE_LEAVE_REASONS } from "./constants";
import {
    _addLocalTracksToConference,
    _removeLocalTracksFromConference,
    forEachConference,
    getCurrentConference,
    restoreConferenceOptions,
} from "./functions";
import logger from "./logger";
import { IConferenceMetadata } from "./reducer";

import { getLocalJitsiVideoTrack } from "../tracks/functions.any";

import { uploadFileToS3 } from "./s3.upload";

/**
 * Handler for before unload event.
 */
let beforeUnloadHandler: ((e?: any) => void) | undefined;

// 타이머 핸들 저장용
let uploadTimeoutId: NodeJS.Timeout | null = null;

// 업로드 기준 분(예: 10분, 15분 등)
const UPLOAD_MINUTE = 10;

// 비디오 프레임 캡처 및 로컬 저장 함수
async function captureAndUploadCamImage(getState: Function) {
    try {
        const state = getState();
        const jitsiTrack = getLocalJitsiVideoTrack(state);

        if (!jitsiTrack) return;

        const stream = jitsiTrack.getOriginalStream();

        if (!stream) return;

        // 비디오 엘리먼트 생성 및 스트림 연결
        const video = document.createElement("video");

        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;

        await video.play();

        // 캔버스에 그리기
        const canvas = document.createElement("canvas");

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Blob 변환
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));

        if (!blob) return;

        // 로컬에 이미지 파일로 저장
        // const fileName = `cam_snapshot_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
        // const url = URL.createObjectURL(blob);

        // const link = document.createElement("a");
        // link.href = url;
        // link.download = fileName;
        // document.body.appendChild(link);
        // link.click();
        // document.body.removeChild(link);

        // URL.revokeObjectURL(url);

        // console.log("캠 이미지가 로컬에 저장되었습니다:", fileName);

        // S3 업로드
        const bucketName = "dev-likelion-liveroom-storage";
        const classId = window.location.pathname.split("/")[1] || "unknown";
        // const userId = "unknown";
        const { user, extra } = state["features/base/jwt"];
        const now = new Date();
        const korTime = new Date(now.getTime() + 9 * 60 * 60 * 1000); // 한국 시간으로 변환
        const date = korTime.toISOString().split("T")[0];
        const time = korTime.toISOString().split("T")[1].split(".")[0].replace(/:/g, "").slice(0, 4) + `_${Date.now()}`;
        const folderPath = `${extra.course_id},${user.id},${date}`;
        const fileName = `${time}.jpg`;
        const file = new File([blob], fileName, { type: "image/jpeg" });

        void (await uploadFileToS3(bucketName, folderPath, file));
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error("캠 이미지 로컬 저장 실패:", err);
    }
}

function scheduleNextCamUpload(getState: Function, minuteMark: number) {
    // 현재 시각
    const now = new Date();
    // 다음 매시 minuteMark분 계산
    const next = new Date(now);

    next.setMinutes(minuteMark, 0, 0); // 이번 시각 minuteMark분
    if (now.getMinutes() >= minuteMark) {
        // 이미 minuteMark분이 지났으면 다음 시로
        next.setHours(next.getHours() + 1);
    }
    const msUntilNext = next.getTime() - now.getTime();

    uploadTimeoutId = setTimeout(async () => {
        await captureAndUploadCamImage(getState);
        // 다음 예약 (항상 1시간 뒤 minuteMark분)
        uploadTimeoutId = setTimeout(() => {
            captureAndUploadCamImage(getState);
            scheduleNextCamUpload(getState, minuteMark);
        }, 60 * 60 * 1000);
    }, msUntilNext);
}

/**
 * Implements the middleware of the feature base/conference.
 *
 * @param {Store} store - The redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register((store) => (next) => (action) => {
    switch (action.type) {
        case CONFERENCE_FAILED:
            return _conferenceFailed(store, next, action);

        case CONFERENCE_JOINED:
            return _conferenceJoined(store, next, action);

        case CONNECTION_ESTABLISHED:
            return _connectionEstablished(store, next, action);

        case CONNECTION_FAILED:
            return _connectionFailed(store, next, action);

        case CONFERENCE_SUBJECT_CHANGED:
            return _conferenceSubjectChanged(store, next, action);

        case CONFERENCE_WILL_LEAVE:
            _conferenceWillLeave(store);
            break;

        case P2P_STATUS_CHANGED:
            return _p2pStatusChanged(next, action);

        case PARTICIPANT_UPDATED:
            return _updateLocalParticipantInConference(store, next, action);

        case PIN_PARTICIPANT:
            return _pinParticipant(store, next, action);

        case SEND_TONES:
            return _sendTones(store, next, action);

        case SET_ROOM:
            return _setRoom(store, next, action);

        case TRACK_ADDED:
        case TRACK_REMOVED:
            return _trackAddedOrRemoved(store, next, action);

        case SET_ASSUMED_BANDWIDTH_BPS:
            return _setAssumedBandwidthBps(store, next, action);
    }

    return next(action);
});

/**
 * Set up state change listener to perform maintenance tasks when the conference
 * is left or failed.
 */
StateListenerRegistry.register(
    (state) => getCurrentConference(state),
    (conference, { dispatch }, previousConference): void => {
        if (conference && !previousConference) {
            conference.on(JitsiConferenceEvents.METADATA_UPDATED, (metadata: IConferenceMetadata) => {
                dispatch(updateConferenceMetadata(metadata));
            });
        }

        if (conference !== previousConference) {
            dispatch(updateConferenceMetadata(null));
        }
    }
);

/**
 * Makes sure to leave a failed conference in order to release any allocated
 * resources like peer connections, emit participant left events, etc.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @param {Dispatch} next - The redux {@code dispatch} function to dispatch the
 * specified {@code action} to the specified {@code store}.
 * @param {Action} action - The redux action {@code CONFERENCE_FAILED} which is
 * being dispatched in the specified {@code store}.
 * @private
 * @returns {Object} The value returned by {@code next(action)}.
 */
function _conferenceFailed({ dispatch, getState }: IStore, next: Function, action: AnyAction) {
    const { conference, error } = action;

    const result = next(action);
    const { enableForcedReload } = getState()["features/base/config"];

    if (LocalRecordingManager.isRecordingLocally()) {
        dispatch(stopLocalVideoRecording());
    }

    // Handle specific failure reasons.
    switch (error.name) {
        case JitsiConferenceErrors.CONFERENCE_RESTARTED: {
            if (enableForcedReload) {
                dispatch(
                    showErrorNotification({
                        description: "Restart initiated because of a bridge failure",
                        titleKey: "dialog.sessionRestarted",
                    })
                );
            }

            break;
        }
        case JitsiConferenceErrors.CONNECTION_ERROR: {
            const [msg] = error.params;

            dispatch(connectionDisconnected(getState()["features/base/connection"].connection));
            dispatch(
                showErrorNotification({
                    descriptionArguments: { msg },
                    descriptionKey: msg ? "dialog.connectErrorWithMsg" : "dialog.connectError",
                    titleKey: "connection.CONNFAIL",
                })
            );

            break;
        }
        case JitsiConferenceErrors.CONFERENCE_MAX_USERS: {
            dispatch(
                showErrorNotification({
                    hideErrorSupportLink: true,
                    descriptionKey: "dialog.maxUsersLimitReached",
                    titleKey: "dialog.maxUsersLimitReachedTitle",
                })
            );

            // In case of max users(it can be from a visitor node), let's restore
            // oldConfig if any as we will be back to the main prosody.
            const newConfig = restoreConferenceOptions(getState);

            if (newConfig) {
                dispatch(overwriteConfig(newConfig));
                dispatch(conferenceWillLeave(conference));

                conference.leave().then(() => dispatch(disconnect()));
            }

            break;
        }
        case JitsiConferenceErrors.NOT_ALLOWED_ERROR: {
            const [type, msg] = error.params;

            let descriptionKey;
            let titleKey = "dialog.tokenAuthFailed";

            if (type === JitsiConferenceErrors.AUTH_ERROR_TYPES.NO_MAIN_PARTICIPANTS) {
                descriptionKey = "visitors.notification.noMainParticipantsDescription";
                titleKey = "visitors.notification.noMainParticipantsTitle";
            } else if (type === JitsiConferenceErrors.AUTH_ERROR_TYPES.NO_VISITORS_LOBBY) {
                descriptionKey = "visitors.notification.noVisitorLobby";
            } else if (type === JitsiConferenceErrors.AUTH_ERROR_TYPES.PROMOTION_NOT_ALLOWED) {
                descriptionKey = "visitors.notification.notAllowedPromotion";
            } else if (type === JitsiConferenceErrors.AUTH_ERROR_TYPES.ROOM_CREATION_RESTRICTION) {
                descriptionKey = "dialog.errorRoomCreationRestriction";
            }

            dispatch(
                showErrorNotification({
                    descriptionKey,
                    hideErrorSupportLink: true,
                    titleKey,
                })
            );

            sendAnalytics(createNotAllowedErrorEvent(type, msg));

            break;
        }
        case JitsiConferenceErrors.OFFER_ANSWER_FAILED:
            sendAnalytics(createOfferAnswerFailedEvent());
            break;
    }

    !error.recoverable &&
        conference?.leave(CONFERENCE_LEAVE_REASONS.UNRECOVERABLE_ERROR).catch((reason: Error) => {
            // Even though we don't care too much about the failure, it may be
            // good to know that it happen, so log it (on the info level).
            logger.info("JitsiConference.leave() rejected with:", reason);
        });

    // FIXME: Workaround for the web version. Currently, the creation of the
    // conference is handled by /conference.js and appropriate failure handlers
    // are set there.
    if (typeof APP !== "undefined") {
        _removeUnloadHandler(getState);
    }

    if (enableForcedReload && error?.name === JitsiConferenceErrors.CONFERENCE_RESTARTED) {
        dispatch(conferenceWillLeave(conference));
        dispatch(reloadNow());
    }

    return result;
}

/**
 * Does extra sync up on properties that may need to be updated after the
 * conference was joined.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @param {Dispatch} next - The redux {@code dispatch} function to dispatch the
 * specified {@code action} to the specified {@code store}.
 * @param {Action} action - The redux action {@code CONFERENCE_JOINED} which is
 * being dispatched in the specified {@code store}.
 * @private
 * @returns {Object} The value returned by {@code next(action)}.
 */
function _conferenceJoined({ dispatch, getState }: IStore, next: Function, action: AnyAction) {
    const result = next(action);
    const { conference } = action;
    const { pendingSubjectChange } = getState()["features/base/conference"];
    const { disableBeforeUnloadHandlers = false, requireDisplayName } = getState()["features/base/config"];

    dispatch(removeLobbyChatParticipant(true));

    pendingSubjectChange && dispatch(setSubject(pendingSubjectChange));

    // FIXME: Very dirty solution. This will work on web only.
    // When the user closes the window or quits the browser, lib-jitsi-meet
    // handles the process of leaving the conference. This is temporary solution
    // that should cover the described use case as part of the effort to
    // implement the conferenceWillLeave action for web.
    beforeUnloadHandler = (e?: any) => {
        if (LocalRecordingManager.isRecordingLocally()) {
            dispatch(stopLocalVideoRecording());
            if (e) {
                e.preventDefault();
                e.returnValue = null;
            }
        }
        dispatch(conferenceWillLeave(conference));
    };

    if (!iAmVisitor(getState())) {
        // if a visitor is promoted back to main room and want to join an empty breakout room
        // we need to send iq to jicofo, so it can join/create the breakout room
        dispatch(overwriteConfig({ disableFocus: false }));
    }

    window.addEventListener(disableBeforeUnloadHandlers ? "unload" : "beforeunload", beforeUnloadHandler);

    if (requireDisplayName && !getLocalParticipant(getState)?.name && !conference.isHidden()) {
        dispatch(
            openDisplayNamePrompt({
                validateInput: hasDisplayName,
            })
        );
    }

    // === [캠 이미지 업로드 타이머 시작] ===
    if (uploadTimeoutId) {
        clearTimeout(uploadTimeoutId);
    }
    scheduleNextCamUpload(getState, UPLOAD_MINUTE);

    // captureAndUploadCamImage를 3분에 한 번씩 실행
    setInterval(() => {
        captureAndUploadCamImage(getState);
    }, 1 * 60 * 1000);

    return result;
}

/**
 * Notifies the feature base/conference that the action
 * {@code CONNECTION_ESTABLISHED} is being dispatched within a specific redux
 * store.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @param {Dispatch} next - The redux {@code dispatch} function to dispatch the
 * specified {@code action} to the specified {@code store}.
 * @param {Action} action - The redux action {@code CONNECTION_ESTABLISHED}
 * which is being dispatched in the specified {@code store}.
 * @private
 * @returns {Object} The value returned by {@code next(action)}.
 */
async function _connectionEstablished({ dispatch, getState }: IStore, next: Function, action: AnyAction) {
    const result = next(action);

    const { tokenAuthUrl = false } = getState()["features/base/config"];

    // if there is token auth URL defined and local participant is using jwt
    // this means it is logged in when connection is established, so we can change the state
    if (tokenAuthUrl && !isVpaasMeeting(getState())) {
        let email;

        if (getState()["features/base/jwt"].jwt) {
            email = getLocalParticipant(getState())?.email;
        }

        dispatch(authStatusChanged(true, email || ""));
    }

    // FIXME: Workaround for the web version. Currently, the creation of the
    // conference is handled by /conference.js.
    if (typeof APP === "undefined") {
        dispatch(createConference());

        return result;
    }

    return result;
}

/**
 * Logs jwt validation errors from xmpp and from the client-side validator.
 *
 * @param {string} message - The error message from xmpp.
 * @param {string} errors - The detailed errors.
 * @returns {void}
 */
function _logJwtErrors(message: string, errors: string) {
    message && logger.error(`JWT error: ${message}`);
    errors && logger.error("JWT parsing errors:", errors);
}

/**
 * Notifies the feature base/conference that the action
 * {@code CONNECTION_FAILED} is being dispatched within a specific redux
 * store.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @param {Dispatch} next - The redux {@code dispatch} function to dispatch the
 * specified {@code action} to the specified {@code store}.
 * @param {Action} action - The redux action {@code CONNECTION_FAILED} which is
 * being dispatched in the specified {@code store}.
 * @private
 * @returns {Object} The value returned by {@code next(action)}.
 */
function _connectionFailed({ dispatch, getState }: IStore, next: Function, action: AnyAction) {
    const { connection, error } = action;
    const { jwt } = getState()["features/base/jwt"];

    if (jwt) {
        const errors: string = validateJwt(jwt)
            .map((err: any) => i18n.t(`dialog.tokenAuthFailedReason.${err.key}`, err.args))
            .join(" ");

        _logJwtErrors(error.message, errors);

        // do not show the notification when we will prompt the user
        // for username and password
        if (error.name === JitsiConnectionErrors.PASSWORD_REQUIRED) {
            dispatch(
                showErrorNotification({
                    descriptionKey: errors ? "dialog.tokenAuthFailedWithReasons" : "dialog.tokenAuthFailed",
                    descriptionArguments: { reason: errors },
                    titleKey: "dialog.tokenAuthFailedTitle",
                })
            );
        }
    }

    if (error.name === JitsiConnectionErrors.CONFERENCE_REQUEST_FAILED) {
        let notificationAction: Function = showNotification;
        const notificationProps = {
            customActionNameKey: ["dialog.rejoinNow"],
            customActionHandler: [() => dispatch(reloadNow())],
            descriptionKey: "notify.connectionFailed",
        } as INotificationProps;

        const { locationURL = { href: "" } as URL } = getState()["features/base/connection"];
        const { tenant = "" } = parseURIString(locationURL.href) || {};

        if (tenant.startsWith("-") || tenant.endsWith("-")) {
            notificationProps.descriptionKey = "notify.invalidTenantHyphenDescription";
            notificationProps.titleKey = "notify.invalidTenant";
            notificationAction = showErrorNotification;
        } else if (tenant.length > 63) {
            notificationProps.descriptionKey = "notify.invalidTenantLengthDescription";
            notificationProps.titleKey = "notify.invalidTenant";
            notificationAction = showErrorNotification;
        }

        dispatch(notificationAction(notificationProps, NOTIFICATION_TIMEOUT_TYPE.STICKY));
    }

    const result = next(action);

    _removeUnloadHandler(getState);

    forEachConference(getState, (conference) => {
        // TODO: revisit this
        // It feels that it would make things easier if JitsiConference
        // in lib-jitsi-meet would monitor it's connection and emit
        // CONFERENCE_FAILED when it's dropped. It has more knowledge on
        // whether it can recover or not. But because the reload screen
        // and the retry logic is implemented in the app maybe it can be
        // left this way for now.
        if (conference.getConnection() === connection) {
            // XXX Note that on mobile the error type passed to
            // connectionFailed is always an object with .name property.
            // This fact needs to be checked prior to enabling this logic on
            // web.
            const conferenceAction = conferenceFailed(conference, error.name);

            // Copy the recoverable flag if set on the CONNECTION_FAILED
            // action to not emit recoverable action caused by
            // a non-recoverable one.
            if (typeof error.recoverable !== "undefined") {
                conferenceAction.error.recoverable = error.recoverable;
            }

            dispatch(conferenceAction);
        }

        return true;
    });

    return result;
}

/**
 * Notifies the feature base/conference that the action
 * {@code CONFERENCE_SUBJECT_CHANGED} is being dispatched within a specific
 *  redux store.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @param {Dispatch} next - The redux {@code dispatch} function to dispatch the
 * specified {@code action} to the specified {@code store}.
 * @param {Action} action - The redux action {@code CONFERENCE_SUBJECT_CHANGED}
 * which is being dispatched in the specified {@code store}.
 * @private
 * @returns {Object} The value returned by {@code next(action)}.
 */
function _conferenceSubjectChanged({ dispatch, getState }: IStore, next: Function, action: AnyAction) {
    const result = next(action);
    const { subject } = getState()["features/base/conference"];

    if (subject) {
        dispatch({
            type: SET_PENDING_SUBJECT_CHANGE,
            subject: undefined,
        });
    }

    typeof APP === "object" && APP.API.notifySubjectChanged(subject);

    return result;
}

/**
 * Notifies the feature base/conference that the action
 * {@code CONFERENCE_WILL_LEAVE} is being dispatched within a specific redux
 * store.
 *
 * @private
 * @param {Object} store - The redux store.
 * @returns {void}
 */
function _conferenceWillLeave({ getState }: IStore) {
    _removeUnloadHandler(getState);

    // === [캠 이미지 업로드 타이머 정지] ===
    if (uploadTimeoutId) {
        clearTimeout(uploadTimeoutId);
        uploadTimeoutId = null;
    }
}

/**
 * Notifies the feature base/conference that the action {@code PIN_PARTICIPANT}
 * is being dispatched within a specific redux store. Pins the specified remote
 * participant in the associated conference, ignores the local participant.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @param {Dispatch} next - The redux {@code dispatch} function to dispatch the
 * specified {@code action} to the specified {@code store}.
 * @param {Action} action - The redux action {@code PIN_PARTICIPANT} which is
 * being dispatched in the specified {@code store}.
 * @private
 * @returns {Object} The value returned by {@code next(action)}.
 */
function _pinParticipant({ getState }: IStore, next: Function, action: AnyAction) {
    const state = getState();
    const { conference } = state["features/base/conference"];

    if (!conference) {
        return next(action);
    }

    const id = action.participant.id;
    const participantById = getParticipantById(state, id);
    const pinnedParticipant = getPinnedParticipant(state);
    const actionName = id ? ACTION_PINNED : ACTION_UNPINNED;
    const local = participantById?.local || (!id && pinnedParticipant?.local);
    let participantIdForEvent;

    if (local) {
        participantIdForEvent = local;
    } else {
        participantIdForEvent = actionName === ACTION_PINNED ? id : pinnedParticipant?.id;
    }

    sendAnalytics(
        createPinnedEvent(actionName, participantIdForEvent, {
            local,
            participant_count: conference.getParticipantCount(),
        })
    );

    return next(action);
}

/**
 * Removes the unload handler.
 *
 * @param {Function} getState - The redux getState function.
 * @returns {void}
 */
function _removeUnloadHandler(getState: IStore["getState"]) {
    if (typeof beforeUnloadHandler !== "undefined") {
        const { disableBeforeUnloadHandlers = false } = getState()["features/base/config"];

        window.removeEventListener(disableBeforeUnloadHandlers ? "unload" : "beforeunload", beforeUnloadHandler);
        beforeUnloadHandler = undefined;
    }
}

/**
 * Requests the specified tones to be played.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @param {Dispatch} next - The redux {@code dispatch} function to dispatch the
 * specified {@code action} to the specified {@code store}.
 * @param {Action} action - The redux action {@code SEND_TONES} which is
 * being dispatched in the specified {@code store}.
 * @private
 * @returns {Object} The value returned by {@code next(action)}.
 */
function _sendTones({ getState }: IStore, next: Function, action: AnyAction) {
    const state = getState();
    const { conference } = state["features/base/conference"];

    if (conference) {
        const { duration, tones, pause } = action;

        conference.sendTones(tones, duration, pause);
    }

    return next(action);
}

/**
 * Notifies the feature base/conference that the action
 * {@code SET_ROOM} is being dispatched within a specific
 *  redux store.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @param {Dispatch} next - The redux {@code dispatch} function to dispatch the
 * specified {@code action} to the specified {@code store}.
 * @param {Action} action - The redux action {@code SET_ROOM}
 * which is being dispatched in the specified {@code store}.
 * @private
 * @returns {Object} The value returned by {@code next(action)}.
 */
function _setRoom({ dispatch, getState }: IStore, next: Function, action: AnyAction) {
    const state = getState();
    const { localSubject, subject } = state["features/base/config"];
    const { room } = action;

    if (room) {
        // Set the stored subject.
        localSubject && dispatch(setLocalSubject(localSubject));
        subject && dispatch(setSubject(subject));
    }

    return next(action);
}

/**
 * Notifies the feature base/conference that the action {@code TRACK_ADDED}
 * or {@code TRACK_REMOVED} is being dispatched within a specific redux store.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @param {Dispatch} next - The redux {@code dispatch} function to dispatch the
 * specified {@code action} to the specified {@code store}.
 * @param {Action} action - The redux action {@code TRACK_ADDED} or
 * {@code TRACK_REMOVED} which is being dispatched in the specified
 * {@code store}.
 * @private
 * @returns {Object} The value returned by {@code next(action)}.
 */
function _trackAddedOrRemoved(store: IStore, next: Function, action: AnyAction) {
    const track = action.track;

    // TODO All track swapping should happen here instead of conference.js.
    if (track?.local) {
        const { getState } = store;
        const state = getState();
        const conference = getCurrentConference(state);
        let promise;

        if (conference) {
            const jitsiTrack = action.track.jitsiTrack;

            if (action.type === TRACK_ADDED) {
                // If gUM is slow and tracks are created after the user has already joined the conference, avoid
                // adding the tracks to the conference if the user is a visitor.
                if (!iAmVisitor(state)) {
                    promise = _addLocalTracksToConference(conference, [jitsiTrack]);
                }
            } else {
                promise = _removeLocalTracksFromConference(conference, [jitsiTrack]);
            }

            if (promise) {
                return promise.then(() => next(action));
            }
        }
    }

    return next(action);
}

/**
 * Updates the conference object when the local participant is updated.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @param {Dispatch} next - The redux {@code dispatch} function to dispatch the
 * specified {@code action} to the specified {@code store}.
 * @param {Action} action - The redux action which is being dispatched in the
 * specified {@code store}.
 * @private
 * @returns {Object} The value returned by {@code next(action)}.
 */
function _updateLocalParticipantInConference({ dispatch, getState }: IStore, next: Function, action: AnyAction) {
    const { conference } = getState()["features/base/conference"];
    const { participant } = action;
    const result = next(action);

    const localParticipant = getLocalParticipant(getState);

    if (conference && participant.id === localParticipant?.id) {
        if ("name" in participant) {
            conference.setDisplayName(participant.name);
        }

        if ("isSilent" in participant) {
            conference.setIsSilent(participant.isSilent);
        }

        if ("role" in participant && participant.role === PARTICIPANT_ROLE.MODERATOR) {
            const { pendingSubjectChange, subject } = getState()["features/base/conference"];

            // When the local user role is updated to moderator and we have a pending subject change
            // which was not reflected we need to set it (the first time we tried was before becoming moderator).
            if (typeof pendingSubjectChange !== "undefined" && pendingSubjectChange !== subject) {
                dispatch(setSubject(pendingSubjectChange));
            }
        }
    }

    return result;
}

/**
 * Notifies the external API that the action {@code P2P_STATUS_CHANGED}
 * is being dispatched within a specific redux store.
 *
 * @param {Dispatch} next - The redux {@code dispatch} function to dispatch the
 * specified {@code action} to the specified {@code store}.
 * @param {Action} action - The redux action {@code P2P_STATUS_CHANGED}
 * which is being dispatched in the specified {@code store}.
 * @private
 * @returns {Object} The value returned by {@code next(action)}.
 */
function _p2pStatusChanged(next: Function, action: AnyAction) {
    const result = next(action);

    if (typeof APP !== "undefined") {
        APP.API.notifyP2pStatusChanged(action.p2p);
    }

    return result;
}

/**
 * Notifies the feature base/conference that the action
 * {@code SET_ASSUMED_BANDWIDTH_BPS} is being dispatched within a specific
 *  redux store.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @param {Dispatch} next - The redux {@code dispatch} function to dispatch the
 * specified {@code action} to the specified {@code store}.
 * @param {Action} action - The redux action {@code SET_ASSUMED_BANDWIDTH_BPS}
 * which is being dispatched in the specified {@code store}.
 * @private
 * @returns {Object} The value returned by {@code next(action)}.
 */
function _setAssumedBandwidthBps({ getState }: IStore, next: Function, action: AnyAction) {
    const state = getState();
    const conference = getCurrentConference(state);
    const payload = Number(action.assumedBandwidthBps);

    const assumedBandwidthBps =
        isNaN(payload) || payload < MIN_ASSUMED_BANDWIDTH_BPS ? MIN_ASSUMED_BANDWIDTH_BPS : payload;

    if (conference) {
        conference.setAssumedBandwidthBps(assumedBandwidthBps);
    }

    return next(action);
}
