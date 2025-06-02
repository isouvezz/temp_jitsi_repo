import React from "react";
import Icon from "../../../base/icons/components/Icon";
import { IconLikelion } from "../../../base/icons/svg";

/**
 * A dummy button component that renders an empty box.
 */
const EmptyButton = () => {
    const handleClick = () => {
        window.open('https://bootcamp.likelion.net/', '_blank');
    };
    return (
        <div className="empty-button" onClick={handleClick}>
            <div>
                <Icon src={IconLikelion} size={30} />
            </div>
        </div>
    );
};

export default EmptyButton;
