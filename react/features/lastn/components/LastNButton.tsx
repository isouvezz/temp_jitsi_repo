import { connect } from "react-redux";

import { IReduxState } from "../../app/types";
import { translate } from "../../base/i18n/functions";
import { IconNoiseSuppressionOff, IconNoiseSuppressionOn } from "../../base/icons/svg";
import AbstractButton, { IProps as AbstractButtonProps } from "../../base/toolbox/components/AbstractButton";
import { setLastN } from "../actions";
import { getLastN, isLastNUnlimited } from "../functions";

interface IProps extends AbstractButtonProps {
    _isLastNUnlimited?: boolean;
    _lastN?: number;
}

/**
 * Component that renders a toolbar button for toggling noise suppression.
 */
class LastNButton extends AbstractButton<IProps> {
    override accessibilityLabel = "toolbar.accessibilityLabel.lastN";
    override icon = IconNoiseSuppressionOn;
    override label = "toolbar.lastN";
    override tooltip = "toolbar.lastN";
    override toggledIcon = IconNoiseSuppressionOff;
    override toggledLabel = "toolbar.disableLastN";

    /**
     * Handles clicking / pressing the button.
     *
     * @private
     * @returns {void}
     */
    override _handleClick() {
        const { dispatch } = this.props;

        dispatch(setLastN(this.props._isLastNUnlimited ? this.props._lastN : -1));
    }

    /**
     * Indicates whether this button is in toggled state or not.
     *
     * @override
     * @protected
     * @returns {boolean}
     */
    override _isToggled() {
        return this.props._isLastNUnlimited || this.props._lastN === -1;
    }
}

/**
 * Maps part of the Redux state to the props of this component.
 *
 * @param {Object} state - The Redux state.
 * @private
 * @returns {IProps}
 */
function _mapStateToProps(state: IReduxState) {
    return {
        _isLastNUnlimited: isLastNUnlimited(state),
        _lastN: getLastN(state),
    };
}

export default translate(connect(_mapStateToProps)(LastNButton));
