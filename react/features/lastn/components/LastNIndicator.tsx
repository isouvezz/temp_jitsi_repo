import React from "react";
import { useSelector } from "react-redux";
import { IReduxState } from "../../app/types";
import { speakerQueue } from "../../large-video/speakerQueue";

const LastNIndicator = () => {
    const lastN = useSelector((state: IReduxState) => state["features/base/lastn"].lastN);
    const speakerCount = speakerQueue.getSpeakerCount();

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                color: "#ff0000",
                padding: "15px",
                textAlign: "center",
                zIndex: 9999,
            }}
        >
            Current lastN: {lastN} | Active Speakers: {speakerCount}
        </div>
    );
};

export default LastNIndicator;
