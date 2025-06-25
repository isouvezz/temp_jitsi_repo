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
 * The type of the React {@code Component} props of {@link CourseTimeDialog}.
 */
interface IProps {
    /**
     * Callback invoked when {@code CourseTimeDialog} is unmounted.
     */
    onClose: () => void;

    /**
     * The start time of the course (HH:MM:SS format).
     */
    startTime?: string;

    /**
     * The end time of the course (HH:MM:SS format).
     */
    endTime?: string;

    /**
     * The course ID for redirect.
     */
    courseId?: string;
}

/**
 * A React {@code Component} for displaying a dialog when course is not available.
 *
 * @param {IProps} props - Component's props.
 * @returns {JSX}
 */
const CourseTimeDialog = ({ onClose, startTime, endTime, courseId }: IProps) => {
    const { classes } = useStyles();
    const { t } = useTranslation();

    useEffect(() => {
        // 5초 후에 리다이렉트
        const timer = setTimeout(() => {
            if (courseId) {
                window.location.href = `https://bootcamp.glob-dev.kong.yk8s.me/my/courses/detail/${courseId}/board`;
            }
        }, 5000);

        return () => {
            clearTimeout(timer);
            onClose?.();
        };
    }, [courseId, onClose]);

    const getMessage = () => {
        const now = new Date();
        const currentTime = now.toTimeString().split(" ")[0]; // HH:MM:SS format

        if (startTime && currentTime < startTime) {
            return "강의가 시작하기 전입니다. 확인 후 다시 접속해주세요. 5초 후 부트캠프로 이동합니다.";
        }

        if (endTime && currentTime > endTime) {
            return "강의가 종료되었습니다. 확인 후 다시 접속해주세요. 5초 후 부트캠프로 이동합니다.";
        }

        return "강의 시간이 아닙니다. 확인 후 다시 접속해주세요. 5초 후 부트캠프로 이동합니다.";
    };

    return (
        <Dialog
            ok={{ hidden: true }}
            cancel={{ hidden: true }}
            size="medium"
            testId="dialog.courseTime"
            disableBackdropClose={true}
            disableEscape={true}
            hideCloseButton={true}
            disableEnter={true}
        >
            <div className={classes.dialog} style={{ fontSize: "1.125rem", whiteSpace: "pre-line" }}>
                <div className={classes.text} style={{ fontSize: "1.125rem", whiteSpace: "pre-line" }}>
                    {getMessage()}
                </div>
            </div>
        </Dialog>
    );
};

export default CourseTimeDialog;
