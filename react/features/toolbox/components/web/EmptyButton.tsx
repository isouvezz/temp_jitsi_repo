import React from "react";
import Icon from "../../../base/icons/components/Icon";
import { IconLikelion } from "../../../base/icons/svg";

/**
 * A dummy button component that renders an empty box.
 */
const EmptyButton = () => {
    return (
        <div className="toolbox-button empty-button">
            <div className="toolbox-icon">
                <Icon src={IconLikelion} size={30} />
            </div>
        </div>
    );
};

export default EmptyButton;
