import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { makeStyles } from "tss-react/mui";

import Dialog from "../../../base/ui/components/web/Dialog";

const useStyles = makeStyles()((theme) => {
    return {
        dialog: {
            marginBottom: theme.spacing(1),
        },

        text: {
            fontSize: "20px",
        },
    };
});

/**
 * The type of the React {@code Component} props of {@link LeaveReasonDialog}.
 */
interface IProps {
    /**
     * Callback invoked when {@code LeaveReasonDialog} is unmounted.
     */
    onClose: () => void;

    /**
     * The title to display in the dialog.
     */
    title?: string;
}

/**
 * A React {@code Component} for displaying a dialog with a reason that ended the conference.
 *
 * @param {IProps} props - Component's props.
 * @returns {JSX}
 */
const LeaveReasonDialog = ({ onClose, title }: IProps) => {
    const { classes } = useStyles();
    const { t } = useTranslation();

    useEffect(
        () => () => {
            onClose?.();
        },
        []
    );

    return (
        <Dialog
            ok={{ hidden: true }}
            cancel={{ hidden: true }}
            size="medium"
            testId="dialog.leaveReason"
            disableBackdropClose={true}
            disableEscape={true}
            hideCloseButton={true}
            disableEnter={true}
        >
            <div className={classes.dialog} style={{ fontSize: "1.125rem", whiteSpace: "pre-line" }}>
                {title ? <div className={classes.text} style={{ fontSize: "1.125rem", whiteSpace: "pre-line" }}>{t(title)}</div> : null}
            </div>
        </Dialog>
    );
};

export default LeaveReasonDialog;
