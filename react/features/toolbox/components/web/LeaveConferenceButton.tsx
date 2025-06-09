import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { createToolbarEvent } from "../../../analytics/AnalyticsEvents";
import { sendAnalytics } from "../../../analytics/functions";
import { leaveConference } from "../../../base/conference/actions";
import { BUTTON_TYPES } from "../../../base/ui/constants.web";
import {
    getParticipantById,
    getRemoteParticipantsSorted,
    isLocalParticipantModerator,
    isParticipantModerator,
} from "../../../base/participants/functions";
import { IStateful } from "../../../base/app/types";
import { openDialog } from "../../../base/dialog/actions";

import { HangupContextMenuItem } from "./HangupContextMenuItem";
import LeaveConferenceDialog from "./LeaveConferenceDialog";

/**
 * The type of the React {@code Component} props of {@link LeaveConferenceButton}.
 */
interface IProps {
    /**
     * Key to use for toolbarButtonClicked event.
     */
    buttonKey: string;

    /**
     * Notify mode for `toolbarButtonClicked` event -
     * whether to only notify or to also prevent button click routine.
     */
    notifyMode?: string;
}

/**
 * Button to leave the conference.
 *
 * @param {Object} props - Component's props.
 * @returns {JSX.Element} - The leave conference button.
 */
export const LeaveConferenceButton = (props: IProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const state = useSelector((state: IStateful) => state);
    const isModerator = useSelector((state: IStateful) => isLocalParticipantModerator(state));
    const participantIds = useSelector((state: IStateful) => getRemoteParticipantsSorted(state));
    const moderatorCount =
        participantIds.filter((id) => {
            const participant = getParticipantById(state, id);
            return participant && isParticipantModerator(participant);
        }).length + (isModerator ? 1 : 0);

    const onLeaveConference = useCallback(() => {
        if (isModerator && moderatorCount === 1) {
            dispatch(openDialog(LeaveConferenceDialog));
        } else {
            sendAnalytics(createToolbarEvent("hangup"));
            dispatch(leaveConference());
        }
    }, [dispatch, isModerator, moderatorCount]);

    return (
        <HangupContextMenuItem
            accessibilityLabel={t("toolbar.accessibilityLabel.leaveConference")}
            buttonKey={props.buttonKey}
            buttonType={BUTTON_TYPES.SECONDARY}
            label={t("toolbar.leaveConference")}
            notifyMode={props.notifyMode}
            onClick={onLeaveConference}
        />
    );
};
