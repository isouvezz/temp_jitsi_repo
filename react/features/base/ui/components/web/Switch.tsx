import React, { useCallback } from "react";
import { makeStyles } from "tss-react/mui";
import { Theme } from "@mui/material/styles";

import { isMobileBrowser } from "../../../environment/utils";
import { ISwitchProps } from "../types";

interface IProps extends ISwitchProps {
    className?: string;

    /**
     * Id of the toggle.
     */
    id?: string;
}

const useStyles = makeStyles()((theme: Theme) => ({
    container: {
        position: "relative",
        backgroundColor: theme.palette.disabled01,
        borderRadius: "12px",
        width: "52px",
        height: "24px",
        border: 0,
        outline: 0,
        cursor: "pointer",
        transition: ".3s",
        display: "inline-block",

        "&.disabled": {
            backgroundColor: theme.palette.disabled01,
            cursor: "default",

            "& .toggle": {
                backgroundColor: theme.palette.ui03,
            },
        },

        "&.is-mobile": {
            height: "32px",
            width: "62px",
            borderRadius: "32px",
        },
    },

    containerOn: {
        backgroundColor: theme.palette.action01,
    },

    toggle: {
        width: "18px",
        height: "18px",
        position: "absolute",
        zIndex: 5,
        top: "2px",
        left: "3px",
        backgroundColor: theme.palette.ui10,
        borderRadius: "100%",
        transition: ".3s",

        "&.is-mobile": {
            width: "24px",
            height: "24px",
        },
    },

    toggleOn: {
        left: "31px",

        "&.is-mobile": {
            left: "34px",
        },
    },

    checkbox: {
        position: "absolute",
        zIndex: 10,
        cursor: "pointer",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        opacity: 0,

        "&.focus-visible + .toggle-checkbox-ring": {
            outline: 0,
            boxShadow: `0px 0px 0px 2px ${theme.palette.focus01}`,
        },
    },

    checkboxRing: {
        position: "absolute",
        pointerEvents: "none",
        zIndex: 6,
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        borderRadius: "12px",

        "&.is-mobile": {
            borderRadius: "32px",
        },
    },

    label: {
        position: "absolute",
        color: theme.palette.text01,
        fontSize: "12px",
        fontWeight: 400,
        zIndex: 4,
        top: "50%",
        transform: "translateY(-50%)",
    },

    labelOn: {
        left: "10px",
    },

    labelOff: {
        right: "5px",
    },
}));

const Switch = ({ className, id, checked, disabled, onChange }: IProps) => {
    const { classes: styles, cx } = useStyles();
    const isMobile = isMobileBrowser();

    const change = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.checked);
    }, []);

    return (
        <span
            className={cx(
                "toggle-container",
                styles.container,
                checked && styles.containerOn,
                isMobile && "is-mobile",
                disabled && "disabled",
                className
            )}
        >
            <input
                type="checkbox"
                {...(id ? { id } : {})}
                checked={checked}
                className={styles.checkbox}
                disabled={disabled}
                onChange={change}
            />
            <div className={cx("toggle-checkbox-ring", styles.checkboxRing, isMobile && "is-mobile")} />
            <div className={cx("toggle", styles.toggle, checked && styles.toggleOn, isMobile && "is-mobile")} />
            {checked ? (
                <span className={cx(styles.label, styles.labelOn)}>ON</span>
            ) : (
                <span className={cx(styles.label, styles.labelOff)}>OFF</span>
            )}
        </span>
    );
};

export default Switch;
