import { connect } from "react-redux";

import { IReduxState } from "../../app/types";
import { translate } from "../../base/i18n/functions";
import { IconNoiseSuppressionOff, IconNoiseSuppressionOn } from "../../base/icons/svg";
import AbstractButton, { IProps as AbstractButtonProps } from "../../base/toolbox/components/AbstractButton";
import { setLastN } from "../actions";
import { setNumberOfVisibleTiles } from "../../base/config/actions";
import { getLastN, isLastNUnlimited } from "../functions";
import { setTileViewDimensions } from "../../filmstrip/actions.web";

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
    override label = "toolbar.disableLastN";
    override tooltip = "toolbar.lastN";
    override toggledIcon = IconNoiseSuppressionOff;
    override toggledLabel = "toolbar.lastN";

    /**
     * 버튼 클릭 시 호출되는 함수입니다.
     *
     * - lastN 제한이 없는 상태(_isLastNUnlimited=true)라면:
     *   - 타일뷰에 최대 4개만 보이도록 numberOfVisibleTiles를 4로 설정
     *   - lastN 값을 2로 설정하여 브릿지에서 2개의 remote 비디오만 받도록 설정
     *
     * - lastN 제한이 있는 상태라면:
     *   - 타일뷰에 최대 50개까지 보이도록 numberOfVisibleTiles를 50으로 설정
     *   - lastN 값을 -1로 설정하여 remote 비디오 제한을 해제
     *
     * - 위 설정이 적용된 후, setTileViewDimensions()를 dispatch하여
     *   타일뷰 레이아웃을 즉시 다시 계산/적용하여 UI에 바로 반영되도록 함
     *
     * @private
     * @returns {void}
     */
    override _handleClick() {
        const { dispatch } = this.props;

        if (this.props._isLastNUnlimited) {
            // lastN 제한이 없는 상태: 타일뷰 4개, lastN=2로 제한
            dispatch(setNumberOfVisibleTiles(4));
            dispatch(setLastN(this.props._lastN || 4, false)); // forceChangeLastN 플래그를 true로 설정
        } else {
            // lastN 제한이 있는 상태: 타일뷰 50개, lastN 제한 해제
            dispatch(setNumberOfVisibleTiles(50));
            dispatch(setLastN(-1, true)); // forceChangeLastN 플래그를 true로 설정
        }

        // 위 설정을 UI에 즉시 반영하기 위해 타일뷰 레이아웃 재계산
        dispatch(setTileViewDimensions());
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
