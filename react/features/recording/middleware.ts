import { batch } from "react-redux";

import { createRecordingEvent } from "../analytics/AnalyticsEvents";
import { sendAnalytics } from "../analytics/functions";
import { IStore } from "../app/types";
import { APP_WILL_MOUNT, APP_WILL_UNMOUNT } from "../base/app/actionTypes";
import { CONFERENCE_JOIN_IN_PROGRESS, CONFERENCE_JOINED } from "../base/conference/actionTypes";
import { getCurrentConference } from "../base/conference/functions";
import { openDialog } from "../base/dialog/actions";
import JitsiMeetJS, { JitsiConferenceEvents, JitsiRecordingConstants } from "../base/lib-jitsi-meet";
import {
    setAudioMuted,
    setAudioUnmutePermissions,
    setVideoMuted,
    setVideoUnmutePermissions,
} from "../base/media/actions";
import { MEDIA_TYPE } from "../base/media/constants";
import { PARTICIPANT_JOINED, PARTICIPANT_UPDATED } from "../base/participants/actionTypes";
import { updateLocalRecordingStatus } from "../base/participants/actions";
import { PARTICIPANT_ROLE } from "../base/participants/constants";
import {
    getLocalParticipant,
    getParticipantDisplayName,
    isLocalParticipantModerator,
} from "../base/participants/functions";
import MiddlewareRegistry from "../base/redux/MiddlewareRegistry";
import StateListenerRegistry from "../base/redux/StateListenerRegistry";
import { playSound, stopSound } from "../base/sounds/actions";
import { TRACK_ADDED } from "../base/tracks/actionTypes";
import { hideNotification, showErrorNotification, showNotification } from "../notifications/actions";
import { NOTIFICATION_TIMEOUT_TYPE } from "../notifications/constants";
import { isRecorderTranscriptionsRunning } from "../transcribing/functions";

import {
    RECORDING_SESSION_UPDATED,
    START_LOCAL_RECORDING,
    STOP_LOCAL_RECORDING,
    SET_AUTO_RECORDING_STARTED_BY_ME,
    SET_RECORDING_START_TIME,
    START_AUTO_RECORDING_CHECK_INTERVAL,
} from "./actionTypes";
import {
    clearRecordingSessions,
    hidePendingRecordingNotification,
    showPendingRecordingNotification,
    showRecordingError,
    showRecordingLimitNotification,
    showRecordingWarning,
    showStartRecordingNotification,
    showStartedRecordingNotification,
    showStoppedRecordingNotification,
    updateRecordingSessionData,
    setAutoRecordingStartedByMe,
    setRecordingStartTime,
    startAutoRecordingCheckInterval,
} from "./actions";
import { RecordingConsentDialog } from "./components/Recording";
import LocalRecordingManager from "./components/Recording/LocalRecordingManager";
import {
    LIVE_STREAMING_OFF_SOUND_ID,
    LIVE_STREAMING_ON_SOUND_ID,
    RECORDING_OFF_SOUND_ID,
    RECORDING_ON_SOUND_ID,
    START_RECORDING_NOTIFICATION_ID,
} from "./constants";
import {
    getResourceId,
    getSessionById,
    registerRecordingAudioFiles,
    shouldRequireRecordingConsent,
    unregisterRecordingAudioFiles,
    isRecordingRunning,
    getActiveSession,
} from "./functions";
import logger from "./logger";

// 자동 녹화 설정 상수
const AUTO_RECORDING_CONFIG = {
    // 녹화 체크 간격 (분)
    CHECK_INTERVAL_MINUTES: 10,
    // 녹화 재시작 간격 (분) - 체크 간격의 2배
    RESTART_INTERVAL_MINUTES: 20,
    // 재시작 여유 시간 (밀리초)
    RESTART_BUFFER_MS: 30000, // 30초
    // 재시작 대기 시간 (밀리초)
    RESTART_DELAY_MS: 3000, // 3초
};

// 자동 녹화 체크 타이머
let autoRecordingCheckInterval: number | null = null;

/**
 * 자동 녹화 체크 함수 - 30분마다 실행
 */
function checkAutoRecording(dispatch: IStore["dispatch"], getState: IStore["getState"]) {
    const state = getState();
    const { autoRecordingStartedByMe, recordingStartTime } = state["features/recording"];
    const conference = getCurrentConference(state);

    if (!conference) {
        return;
    }

    // 클라우드 녹화 상태 확인
    const isCurrentlyRecording = isRecordingRunning(state);

    // 녹화 중이 아니면 시작
    if (!isCurrentlyRecording) {
        logger.info("Auto recording: Starting cloud recording as it is not running");

        // 클라우드 녹화 시작
        conference.startRecording({
            mode: JitsiRecordingConstants.mode.FILE,
            appData: JSON.stringify({
                file_recording_metadata: {
                    share: true,
                },
            }),
        });

        dispatch(setAutoRecordingStartedByMe(true));
        dispatch(setRecordingStartTime(Date.now()));
        return;
    }

    // 녹화 중이고 내가 시작한 녹화라면 재시작 간격 경과 확인
    if (isCurrentlyRecording && autoRecordingStartedByMe && recordingStartTime) {
        const elapsedTime = Date.now() - recordingStartTime;
        const restartInterval = AUTO_RECORDING_CONFIG.RESTART_INTERVAL_MINUTES * 60 * 1000; // 분을 밀리초로 변환

        // 재시작 간격의 배수인지 확인 (20분, 40분, 60분...)
        if (elapsedTime > 0 && elapsedTime % restartInterval < AUTO_RECORDING_CONFIG.RESTART_BUFFER_MS) {
            // 설정된 여유 시간 내
            logger.info(
                `Auto recording: Restarting cloud recording after ${AUTO_RECORDING_CONFIG.RESTART_INTERVAL_MINUTES} minutes`
            );

            // 현재 활성 녹화 세션 찾기
            const activeSession = getActiveSession(state, JitsiRecordingConstants.mode.FILE);

            if (activeSession && activeSession.id) {
                // 클라우드 녹화 종료
                conference.stopRecording(activeSession.id);

                // 설정된 대기 시간 후 재시작
                setTimeout(() => {
                    const currentState = getState();
                    const currentConference = getCurrentConference(currentState);

                    if (currentConference && !isRecordingRunning(currentState)) {
                        // 클라우드 녹화 재시작
                        currentConference.startRecording({
                            mode: JitsiRecordingConstants.mode.FILE,
                            appData: JSON.stringify({
                                file_recording_metadata: {
                                    share: true,
                                },
                            }),
                        });
                        dispatch(setRecordingStartTime(Date.now()));
                    }
                }, AUTO_RECORDING_CONFIG.RESTART_DELAY_MS);
            }
        }
    }
}

/**
 * 내가 호스트이고 녹화를 시작해야 하는지 확인하는 함수
 */
function shouldStartAutoRecording(dispatch: IStore["dispatch"], getState: IStore["getState"]) {
    const state = getState();
    const isModerator = isLocalParticipantModerator(state);
    const isCurrentlyRecording = isRecordingRunning(state);

    // 내가 호스트이고 현재 녹화 중이 아니면 녹화 시작
    if (isModerator && !isCurrentlyRecording) {
        logger.info("I am moderator, starting automatic cloud recording...");

        const conference = getCurrentConference(state);
        if (conference) {
            // 클라우드 녹화 시작
            conference.startRecording({
                mode: JitsiRecordingConstants.mode.FILE,
                appData: JSON.stringify({
                    file_recording_metadata: {
                        share: true,
                    },
                }),
            });

            dispatch(setAutoRecordingStartedByMe(true));
            dispatch(setRecordingStartTime(Date.now()));

            // 자동 녹화 체크 타이머 시작 (설정된 간격마다)
            if (!autoRecordingCheckInterval) {
                autoRecordingCheckInterval = setInterval(() => {
                    checkAutoRecording(dispatch, getState);
                }, AUTO_RECORDING_CONFIG.CHECK_INTERVAL_MINUTES * 60 * 1000); // 분을 밀리초로 변환
                dispatch(startAutoRecordingCheckInterval());
            }
        }
    }
}

/**
 * StateListenerRegistry provides a reliable way to detect the leaving of a
 * conference, where we need to clean up the recording sessions.
 */
StateListenerRegistry.register(
    /* selector */ (state) => getCurrentConference(state),
    /* listener */ (conference, { dispatch }) => {
        if (!conference) {
            dispatch(clearRecordingSessions());

            // 자동 녹화 체크 타이머 정리
            if (autoRecordingCheckInterval) {
                clearInterval(autoRecordingCheckInterval);
                autoRecordingCheckInterval = null;
            }
        }
    }
);

/**
 * The redux middleware to handle the recorder updates in a React way.
 *
 * @param {Store} store - The redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register(({ dispatch, getState }) => (next) => (action) => {
    let oldSessionData;

    if (action.type === RECORDING_SESSION_UPDATED) {
        oldSessionData = getSessionById(getState(), action.sessionData.id);
    }

    const result = next(action);

    switch (action.type) {
        case APP_WILL_MOUNT:
            registerRecordingAudioFiles(dispatch);
            break;

        case APP_WILL_UNMOUNT:
            unregisterRecordingAudioFiles(dispatch);

            // 자동 녹화 체크 타이머 정리
            if (autoRecordingCheckInterval) {
                clearInterval(autoRecordingCheckInterval);
                autoRecordingCheckInterval = null;
            }
            break;

        case CONFERENCE_JOIN_IN_PROGRESS: {
            const { conference } = action;

            conference.on(JitsiConferenceEvents.RECORDER_STATE_CHANGED, (recorderSession: any) => {
                if (recorderSession) {
                    recorderSession.getID() && dispatch(updateRecordingSessionData(recorderSession));
                    if (recorderSession.getError()) {
                        _showRecordingErrorNotification(recorderSession, dispatch, getState);
                    } else {
                        _showExplicitConsentDialog(recorderSession, dispatch, getState);
                    }
                }

                return;
            });

            break;
        }

        case CONFERENCE_JOINED: {
            // 내가 회의에 입장 성공했을 때 호스트 권한 확인 후 녹화 시작
            shouldStartAutoRecording(dispatch, getState);
            break;
        }

        case PARTICIPANT_UPDATED: {
            const { id, role } = action.participant;
            const state = getState();
            const localParticipant = getLocalParticipant(state);

            // 내 역할이 변경되었을 때만 처리
            if (localParticipant?.id === id) {
                // 내가 호스트가 되었을 때 녹화 시작
                if (role === PARTICIPANT_ROLE.MODERATOR) {
                    shouldStartAutoRecording(dispatch, getState);
                }

                // 기존 알림 표시 로직
                dispatch(showStartRecordingNotification());
            }

            return next(action);
        }

        case START_LOCAL_RECORDING: {
            const { localRecording } = getState()["features/base/config"];
            const { onlySelf } = action;

            LocalRecordingManager.startLocalRecording(
                {
                    dispatch,
                    getState,
                },
                action.onlySelf
            )
                .then(() => {
                    const props = {
                        descriptionKey: "recording.on",
                        titleKey: "dialog.recording",
                    };

                    if (localRecording?.notifyAllParticipants && !onlySelf) {
                        dispatch(playSound(RECORDING_ON_SOUND_ID));
                    }
                    dispatch(showNotification(props, NOTIFICATION_TIMEOUT_TYPE.MEDIUM));
                    dispatch(
                        showNotification(
                            {
                                titleKey: "recording.localRecordingStartWarningTitle",
                                descriptionKey: "recording.localRecordingStartWarning",
                            },
                            NOTIFICATION_TIMEOUT_TYPE.STICKY
                        )
                    );
                    dispatch(updateLocalRecordingStatus(true, onlySelf));
                    sendAnalytics(createRecordingEvent("started", `local${onlySelf ? ".self" : ""}`));
                    if (typeof APP !== "undefined") {
                        APP.API.notifyRecordingStatusChanged(
                            true,
                            "local",
                            undefined,
                            isRecorderTranscriptionsRunning(getState())
                        );
                    }
                })
                .catch((err) => {
                    logger.error("Capture failed", err);

                    let descriptionKey = "recording.error";

                    if (err.message === "WrongSurfaceSelected") {
                        descriptionKey = "recording.surfaceError";
                    } else if (err.message === "NoLocalStreams") {
                        descriptionKey = "recording.noStreams";
                    } else if (err.message === "NoMicTrack") {
                        descriptionKey = "recording.noMicPermission";
                    }
                    const props = {
                        descriptionKey,
                        titleKey: "recording.failedToStart",
                    };

                    if (typeof APP !== "undefined") {
                        APP.API.notifyRecordingStatusChanged(
                            false,
                            "local",
                            err.message,
                            isRecorderTranscriptionsRunning(getState())
                        );
                    }

                    dispatch(showErrorNotification(props));
                });
            break;
        }

        case STOP_LOCAL_RECORDING: {
            const { localRecording } = getState()["features/base/config"];

            if (LocalRecordingManager.isRecordingLocally()) {
                LocalRecordingManager.stopLocalRecording();
                dispatch(updateLocalRecordingStatus(false));
                if (localRecording?.notifyAllParticipants && !LocalRecordingManager.selfRecording) {
                    dispatch(playSound(RECORDING_OFF_SOUND_ID));
                }
                if (typeof APP !== "undefined") {
                    APP.API.notifyRecordingStatusChanged(
                        false,
                        "local",
                        undefined,
                        isRecorderTranscriptionsRunning(getState())
                    );
                }
            }
            break;
        }

        case RECORDING_SESSION_UPDATED: {
            const state = getState();

            // When in recorder mode no notifications are shown
            // or extra sounds are also not desired
            // but we want to indicate those in case of sip gateway
            const { iAmRecorder, iAmSipGateway, recordingLimit } = state["features/base/config"];

            if (iAmRecorder && !iAmSipGateway) {
                break;
            }

            const updatedSessionData = getSessionById(state, action.sessionData.id);
            const { initiator, mode = "", terminator } = updatedSessionData ?? {};
            const { PENDING, OFF, ON } = JitsiRecordingConstants.status;
            const isRecordingStarting = updatedSessionData?.status === PENDING && oldSessionData?.status !== PENDING;

            if (isRecordingStarting || updatedSessionData?.status === ON) {
                dispatch(hideNotification(START_RECORDING_NOTIFICATION_ID));
            }

            if (isRecordingStarting) {
                dispatch(showPendingRecordingNotification(mode));
                break;
            }

            dispatch(hidePendingRecordingNotification(mode));

            if (updatedSessionData?.status === ON) {
                // We receive 2 updates of the session status ON. The first one is from jibri when it joins.
                // The second one is from jicofo which will deliver the initiator value. Since the start
                // recording notification uses the initiator value we skip the jibri update and show the
                // notification on the update from jicofo.
                // FIXME: simplify checks when the backend start sending only one status ON update containing
                // the initiator.
                if (initiator && !oldSessionData?.initiator) {
                    if (typeof recordingLimit === "object") {
                        dispatch(showRecordingLimitNotification(mode));
                    } else {
                        dispatch(showStartedRecordingNotification(mode, initiator, action.sessionData.id));
                    }
                }

                if (oldSessionData?.status !== ON) {
                    sendAnalytics(createRecordingEvent("start", mode));

                    let soundID;

                    if (mode === JitsiRecordingConstants.mode.FILE && !isRecorderTranscriptionsRunning(state)) {
                        soundID = RECORDING_ON_SOUND_ID;
                    } else if (mode === JitsiRecordingConstants.mode.STREAM) {
                        soundID = LIVE_STREAMING_ON_SOUND_ID;
                    }

                    if (soundID) {
                        dispatch(playSound(soundID));
                    }

                    if (typeof APP !== "undefined") {
                        APP.API.notifyRecordingStatusChanged(
                            true,
                            mode,
                            undefined,
                            isRecorderTranscriptionsRunning(state)
                        );
                    }
                }
            } else if (updatedSessionData?.status === OFF && oldSessionData?.status !== OFF) {
                if (terminator) {
                    dispatch(
                        showStoppedRecordingNotification(
                            mode,
                            getParticipantDisplayName(state, getResourceId(terminator))
                        )
                    );
                }

                let duration = 0,
                    soundOff,
                    soundOn;

                if (oldSessionData?.timestamp) {
                    duration = Date.now() / 1000 - oldSessionData.timestamp;
                }
                sendAnalytics(createRecordingEvent("stop", mode, duration));

                if (mode === JitsiRecordingConstants.mode.FILE && !isRecorderTranscriptionsRunning(state)) {
                    soundOff = RECORDING_OFF_SOUND_ID;
                    soundOn = RECORDING_ON_SOUND_ID;
                } else if (mode === JitsiRecordingConstants.mode.STREAM) {
                    soundOff = LIVE_STREAMING_OFF_SOUND_ID;
                    soundOn = LIVE_STREAMING_ON_SOUND_ID;
                }

                if (soundOff && soundOn) {
                    dispatch(stopSound(soundOn));
                    dispatch(playSound(soundOff));
                }

                if (typeof APP !== "undefined") {
                    APP.API.notifyRecordingStatusChanged(
                        false,
                        mode,
                        undefined,
                        isRecorderTranscriptionsRunning(state)
                    );
                }
            }

            break;
        }
        case TRACK_ADDED: {
            const { track } = action;

            if (LocalRecordingManager.isRecordingLocally() && track.mediaType === MEDIA_TYPE.AUDIO) {
                const audioTrack = track.jitsiTrack.track;

                LocalRecordingManager.addAudioTrackToLocalRecording(audioTrack);
            }
            break;
        }
    }

    return result;
});

/**
 * Shows a notification about an error in the recording session. A
 * default notification will display if no error is specified in the passed
 * in recording session.
 *
 * @private
 * @param {Object} session - The recorder session model from the
 * lib.
 * @param {Dispatch} dispatch - The Redux Dispatch function.
 * @param {Function} getState - The Redux getState function.
 * @returns {void}
 */
function _showRecordingErrorNotification(session: any, dispatch: IStore["dispatch"], getState: IStore["getState"]) {
    const mode = session.getMode();
    const error = session.getError();
    const isStreamMode = mode === JitsiMeetJS.constants.recording.mode.STREAM;

    switch (error) {
        case JitsiMeetJS.constants.recording.error.SERVICE_UNAVAILABLE:
            dispatch(
                showRecordingError({
                    descriptionKey: "recording.unavailable",
                    descriptionArguments: {
                        serviceName: isStreamMode ? "$t(liveStreaming.serviceName)" : "$t(recording.serviceName)",
                    },
                    titleKey: isStreamMode ? "liveStreaming.unavailableTitle" : "recording.unavailableTitle",
                })
            );
            break;
        case JitsiMeetJS.constants.recording.error.RESOURCE_CONSTRAINT:
            dispatch(
                showRecordingError({
                    descriptionKey: isStreamMode ? "liveStreaming.busy" : "recording.busy",
                    titleKey: isStreamMode ? "liveStreaming.busyTitle" : "recording.busyTitle",
                })
            );
            break;
        case JitsiMeetJS.constants.recording.error.UNEXPECTED_REQUEST:
            dispatch(
                showRecordingWarning({
                    descriptionKey: isStreamMode
                        ? "liveStreaming.sessionAlreadyActive"
                        : "recording.sessionAlreadyActive",
                    titleKey: isStreamMode ? "liveStreaming.inProgress" : "recording.inProgress",
                })
            );
            break;
        case JitsiMeetJS.constants.recording.error.POLICY_VIOLATION:
            dispatch(
                showRecordingWarning({
                    descriptionKey: isStreamMode ? "liveStreaming.policyError" : "recording.policyError",
                    titleKey: isStreamMode ? "liveStreaming.failedToStart" : "recording.failedToStart",
                })
            );
            break;
        default:
            dispatch(
                showRecordingError({
                    descriptionKey: isStreamMode ? "liveStreaming.error" : "recording.error",
                    titleKey: isStreamMode ? "liveStreaming.failedToStart" : "recording.failedToStart",
                })
            );
            break;
    }

    if (typeof APP !== "undefined") {
        APP.API.notifyRecordingStatusChanged(false, mode, error, isRecorderTranscriptionsRunning(getState()));
    }
}

/**
 * Mutes audio and video and displays the RecordingConsentDialog when the conditions are met.
 *
 * @param {any} recorderSession - The recording session.
 * @param {Function} dispatch - The Redux dispatch function.
 * @param {Function} getState - The Redux getState function.
 * @returns {void}
 */
function _showExplicitConsentDialog(recorderSession: any, dispatch: IStore["dispatch"], getState: IStore["getState"]) {
    if (!shouldRequireRecordingConsent(recorderSession, getState())) {
        return;
    }

    batch(() => {
        dispatch(setAudioUnmutePermissions(true, true));
        dispatch(setVideoUnmutePermissions(true, true));
        dispatch(setAudioMuted(true));
        dispatch(setVideoMuted(true));
        dispatch(openDialog(RecordingConsentDialog));
    });
}
