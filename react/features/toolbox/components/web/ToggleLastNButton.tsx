import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { setLastN } from "../../../base/lastn/actions";
import { IconCameraRefresh } from "../../../base/icons/svg";
import type { IReduxState } from "../../../app/types";

const ToggleLastNButton = () => {
    const dispatch = useDispatch();
    const lastN = useSelector((state: IReduxState) => state["features/base/lastn"].lastN);
    const channelLastN = useSelector((state: IReduxState) => state["features/base/config"].channelLastN ?? 4);
    const isUnlimited = lastN === -1;

    const handleClick = () => {
        dispatch(setLastN(isUnlimited ? channelLastN : -1));
    };

    return (
        <button
            className="toolbox-button"
            onClick={handleClick}
            title={isUnlimited ? "모든 참가자 보기 해제" : "모든 참가자 보기"}
            type="button"
        >
            <IconCameraRefresh />
        </button>
    );
};

export default ToggleLastNButton;
