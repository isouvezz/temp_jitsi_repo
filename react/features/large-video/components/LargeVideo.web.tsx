import React, { Component } from "react";
import { connect } from "react-redux";

// @ts-expect-error
import VideoLayout from "../../../../modules/UI/videolayout/VideoLayout";
import { IReduxState, IStore } from "../../app/types";
import { isDisplayNameVisible } from "../../base/config/functions.web";
import { VIDEO_TYPE } from "../../base/media/constants";
import { getLocalParticipant, getScreenshareParticipantIds } from "../../base/participants/functions";
import Watermarks from "../../base/react/components/web/Watermarks";
import { getHideSelfView } from "../../base/settings/functions.any";
import { getVideoTrackByParticipant } from "../../base/tracks/functions.web";
import { setColorAlpha } from "../../base/util/helpers";
import { isSpotTV } from "../../base/util/spot";
import StageParticipantNameLabel from "../../display-name/components/web/StageParticipantNameLabel";
import { FILMSTRIP_BREAKPOINT } from "../../filmstrip/constants";
import { getVerticalViewMaxWidth, isFilmstripResizable } from "../../filmstrip/functions.web";
import SharedVideo from "../../shared-video/components/web/SharedVideo";
import Captions from "../../subtitles/components/web/Captions";
import { areClosedCaptionsEnabled } from "../../subtitles/functions.any";
import { setTileView } from "../../video-layout/actions.web";
import Whiteboard from "../../whiteboard/components/web/Whiteboard";
import { isWhiteboardEnabled } from "../../whiteboard/functions";
import { setSeeWhatIsBeingShared } from "../actions.web";
import { getLargeVideoParticipant } from "../functions";
import { setLastN } from "../../lastn/actions";
import ScreenSharePlaceholder from "./ScreenSharePlaceholder.web";
import { isLayoutTileView } from "../../video-layout/functions.any";
import { speakerQueue } from "../speakerQueue";

interface IProps {
    /**
     * The alpha(opacity) of the background.
     */
    _backgroundAlpha?: number;

    /**
     * The user selected background color.
     */
    _customBackgroundColor: string;

    /**
     * The user selected background image url.
     */
    _customBackgroundImageUrl: string;

    /**
     * Whether the screen-sharing placeholder should be displayed or not.
     */
    _displayScreenSharingPlaceholder: boolean;

    /**
     * Whether or not the hideSelfView is enabled.
     */
    _hideSelfView: boolean;

    /**
     * Prop that indicates whether the chat is open.
     */
    _isChatOpen: boolean;

    /**
     * Whether or not the display name is visible.
     */
    _isDisplayNameVisible: boolean;

    /**
     * Whether or not the local screen share is on large-video.
     */
    _isScreenSharing: boolean;

    /**
     * Whether or not the local screen share is on large-video.
     */
    _isLocalScreenShare: boolean;

    /**
     * Whether or not there is any screen sharing in the conference.
     */
    _isHasSharingScreen: boolean;

    /**
     * The large video participant id.
     */
    _largeVideoParticipantId: string;

    /**
     * Local Participant id.
     */
    _localParticipantId: string;

    /**
     * Used to determine the value of the autoplay attribute of the underlying
     * video element.
     */
    _noAutoPlayVideo: boolean;

    /**
     * Whether or not the filmstrip is resizable.
     */
    _resizableFilmstrip: boolean;

    /**
     * Whether or not the screen sharing is visible.
     */
    _seeWhatIsBeingShared: boolean;

    /**
     * Whether or not to show dominant speaker badge.
     */
    _showDominantSpeakerBadge: boolean;

    /**
     * Whether or not to show subtitles button.
     */
    _showSubtitles?: boolean;

    /**
     * The width of the vertical filmstrip (user resized).
     */
    _verticalFilmstripWidth?: number | null;

    /**
     * The max width of the vertical filmstrip.
     */
    _verticalViewMaxWidth: number;

    /**
     * Whether or not the filmstrip is visible.
     */
    _visibleFilmstrip: boolean;

    /**
     * Whether or not the whiteboard is ready to be used.
     */
    _whiteboardEnabled: boolean;

    /**
     * The configured lastN value from config.
     */
    _configLastN: number;

    /**
     * The lastN value set by the component.
     */
    _setLastN: number;

    /**
     * Whether the local participant is the dominant speaker.
     */
    _isDominantSpeaker: boolean;

    /**
     * Whether the tile view is enabled.
     */
    _tileViewEnabled: boolean;

    /**
     * The Redux dispatch function.
     */
    dispatch: IStore["dispatch"];

    /**
     * The speakers array.
     */
    _speakers: any[];

    /**
     * The speaker count.
     */
    _speakerCount: number;

    /**
     * Whether to force change lastN.
     */
    _forceChangeLastN: boolean;
}

/** .
 * Implements a React {@link Component} which represents the large video (a.k.a.
 * The conference participant who is on the local stage) on Web/React.
 *
 * @augments Component
 */
class LargeVideo extends Component<IProps> {
    _tappedTimeout: number | undefined;
    _containerRef: React.RefObject<HTMLDivElement>;
    _wrapperRef: React.RefObject<HTMLDivElement>;

    constructor(props: IProps) {
        super(props);

        this._containerRef = React.createRef<HTMLDivElement>();
        this._wrapperRef = React.createRef<HTMLDivElement>();

        this._clearTapTimeout = this._clearTapTimeout.bind(this);
        this._onDoubleTap = this._onDoubleTap.bind(this);
        this._updateLayout = this._updateLayout.bind(this);
    }

    override componentDidMount() {
        // speakerQueue에 dispatch 함수 전달
        speakerQueue.setDispatchCallback(this.props.dispatch);
    }

    override componentDidUpdate(prevProps: IProps) {
        const {
            _visibleFilmstrip,
            _isScreenSharing,
            _isHasSharingScreen,
            _seeWhatIsBeingShared,
            _largeVideoParticipantId,
            _hideSelfView,
            _localParticipantId,
            _configLastN,
            _tileViewEnabled,
            _isLocalScreenShare,
            _speakerCount,
        } = this.props;

        if (prevProps._visibleFilmstrip !== _visibleFilmstrip) {
            this._updateLayout();
        }

        if (prevProps._isScreenSharing !== _isScreenSharing && !_isScreenSharing) {
            this.props.dispatch(setSeeWhatIsBeingShared(false));
        }

        //강제 변환 코드
        const forceChangeLastN = this.props._forceChangeLastN;

        if (!forceChangeLastN) {
            if (_isHasSharingScreen && !_tileViewEnabled) {
                // if (_isLocalScreenShare) {
                //     if (this.props._isDominantSpeaker && _speakerCount == 0) {
                //         this.props.dispatch(setLastN(0));
                //     } else {
                //         this.props.dispatch(
                //             setLastN(this.props._isDominantSpeaker ? _speakerCount - 1 : _speakerCount)
                //         );
                //     }
                // } else {
                //     if (this.props._isDominantSpeaker && _speakerCount == 0) {
                //         this.props.dispatch(setLastN(1));
                //     } else {
                //         this.props.dispatch(
                //             setLastN(this.props._isDominantSpeaker ? _speakerCount : _speakerCount + 1)
                //         );
                //     }
                // }

                if (this.props._isDominantSpeaker && _speakerCount == 0) {
                    this.props.dispatch(setLastN(1));
                } else {
                    this.props.dispatch(setLastN(this.props._isDominantSpeaker ? _speakerCount : _speakerCount + 1));
                }
            } else {
                this.props.dispatch(setLastN(_configLastN));
            }
        }

        if (_isScreenSharing && _seeWhatIsBeingShared) {
            VideoLayout.updateLargeVideo(_largeVideoParticipantId, true, true);
        }

        if (_largeVideoParticipantId === _localParticipantId && prevProps._hideSelfView !== _hideSelfView) {
            VideoLayout.updateLargeVideo(_largeVideoParticipantId, true, false);
        }
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {React$Element}
     */
    override render() {
        const {
            _displayScreenSharingPlaceholder,
            _isChatOpen,
            _isDisplayNameVisible,
            _noAutoPlayVideo,
            _showDominantSpeakerBadge,
            _whiteboardEnabled,
            _showSubtitles,
        } = this.props;
        const style = this._getCustomStyles();
        const className = `videocontainer${_isChatOpen ? " shift-right" : ""}`;

        return (
            <div className={className} id="largeVideoContainer" ref={this._containerRef} style={style}>
                <SharedVideo />
                {_whiteboardEnabled && <Whiteboard />}
                <div id="etherpad" />
                {/* 워터마크 제거 */}
                {/* <Watermarks /> */}

                <div id="dominantSpeaker" onTouchEnd={this._onDoubleTap}>
                    <div className="dynamic-shadow" />
                    <div id="dominantSpeakerAvatarContainer" />
                </div>
                <div id="remotePresenceMessage" />
                <span id="remoteConnectionMessage" />
                <div id="largeVideoElementsContainer">
                    <div id="largeVideoBackgroundContainer" />
                    {/*
                     * FIXME: the architecture of elements related to the large
                     * video and the naming. The background is not part of
                     * largeVideoWrapper because we are controlling the size of
                     * the video through largeVideoWrapper. That's why we need
                     * another container for the background and the
                     * largeVideoWrapper in order to hide/show them.
                     */}
                    {_displayScreenSharingPlaceholder ? <ScreenSharePlaceholder /> : <></>}
                    <div id="largeVideoWrapper" onTouchEnd={this._onDoubleTap} ref={this._wrapperRef} role="figure">
                        <video
                            autoPlay={!_noAutoPlayVideo}
                            id="largeVideo"
                            muted={true}
                            playsInline={true} /* for Safari on iOS to work */
                        />
                    </div>
                </div>
                {!interfaceConfig.DISABLE_TRANSCRIPTION_SUBTITLES && _showSubtitles && <Captions />}
                {_isDisplayNameVisible && _showDominantSpeakerBadge && <StageParticipantNameLabel />}
            </div>
        );
    }

    /**
     * Refreshes the video layout to determine the dimensions of the stage view.
     * If the filmstrip is toggled it adds CSS transition classes and removes them
     * when the transition is done.
     *
     * @returns {void}
     */
    _updateLayout() {
        const { _verticalFilmstripWidth, _resizableFilmstrip } = this.props;

        if (_resizableFilmstrip && Number(_verticalFilmstripWidth) >= FILMSTRIP_BREAKPOINT) {
            this._containerRef.current?.classList.add("transition");
            this._wrapperRef.current?.classList.add("transition");
            VideoLayout.refreshLayout();

            setTimeout(() => {
                this._containerRef?.current && this._containerRef.current.classList.remove("transition");
                this._wrapperRef?.current && this._wrapperRef.current.classList.remove("transition");
            }, 1000);
        } else {
            VideoLayout.refreshLayout();
        }
    }

    /**
     * Clears the '_tappedTimout'.
     *
     * @private
     * @returns {void}
     */
    _clearTapTimeout() {
        clearTimeout(this._tappedTimeout);
        this._tappedTimeout = undefined;
    }

    /**
     * Creates the custom styles object.
     *
     * @private
     * @returns {Object}
     */
    _getCustomStyles() {
        const styles: any = {};
        const {
            _customBackgroundColor,
            _customBackgroundImageUrl,
            _verticalFilmstripWidth,
            _verticalViewMaxWidth,
            _visibleFilmstrip,
        } = this.props;

        styles.backgroundColor = _customBackgroundColor || interfaceConfig.DEFAULT_BACKGROUND;

        if (this.props._backgroundAlpha !== undefined) {
            const alphaColor = setColorAlpha(styles.backgroundColor, this.props._backgroundAlpha);

            styles.backgroundColor = alphaColor;
        }

        if (_customBackgroundImageUrl) {
            styles.backgroundImage = `url(${_customBackgroundImageUrl})`;
            styles.backgroundSize = "cover";
        }

        if (_visibleFilmstrip && Number(_verticalFilmstripWidth) >= FILMSTRIP_BREAKPOINT) {
            styles.width = `calc(100% - ${_verticalViewMaxWidth || 0}px)`;
        }

        return styles;
    }

    /**
     * Sets view to tile view on double tap.
     *
     * @param {Object} e - The event.
     * @private
     * @returns {void}
     */
    _onDoubleTap(e: React.TouchEvent) {
        e.stopPropagation();
        e.preventDefault();

        if (this._tappedTimeout) {
            this._clearTapTimeout();
            this.props.dispatch(setTileView(true));
        } else {
            this._tappedTimeout = window.setTimeout(this._clearTapTimeout, 300);
        }
    }
}

/**
 * Maps (parts of) the Redux state to the associated LargeVideo props.
 *
 * @param {Object} state - The Redux state.
 * @private
 * @returns {IProps}
 */
function _mapStateToProps(state: IReduxState) {
    const testingConfig = state["features/base/config"].testing;
    const { backgroundColor, backgroundImageUrl } = state["features/dynamic-branding"];
    const { isOpen: isChatOpen } = state["features/chat"];
    const { width: verticalFilmstripWidth, visible } = state["features/filmstrip"];
    const { hideDominantSpeakerBadge } = state["features/base/config"];
    const { seeWhatIsBeingShared, speakers, speakerCount } = state["features/large-video"];
    const localParticipant = getLocalParticipant(state);
    const largeVideoParticipant = getLargeVideoParticipant(state);
    const videoTrack = getVideoTrackByParticipant(state, largeVideoParticipant);
    const isLocalScreenshareOnLargeVideo =
        largeVideoParticipant?.id?.includes(localParticipant?.id ?? "") && videoTrack?.videoType === VIDEO_TYPE.DESKTOP;

    // 모든 참가자의 비디오 트랙 확인
    const participants = state["features/base/participants"];
    const screenshareParticipantIds = getScreenshareParticipantIds(state);
    const isLocalScreenShare = screenshareParticipantIds.includes(localParticipant?.id ?? "");
    const hasScreenShare = screenshareParticipantIds.length > 0;

    const configLastN = state["features/base/config"].channelLastN ?? 4;
    const setLastN = state["features/base/lastn"]?.lastN ?? configLastN;
    const isDominantSpeaker = localParticipant?.id === state["features/base/lastn"].speakerId;
    const isTileView = isLayoutTileView(state);

    const forceChangeLastN = state["features/base/lastn"]?.forceChangeLastN ?? false;

    return {
        _backgroundAlpha: state["features/base/config"].backgroundAlpha,
        _customBackgroundColor: backgroundColor,
        _customBackgroundImageUrl: backgroundImageUrl,
        _configLastN: configLastN,
        _setLastN: setLastN,
        _displayScreenSharingPlaceholder: Boolean(
            isLocalScreenshareOnLargeVideo && !seeWhatIsBeingShared && !isSpotTV()
        ),
        _hideSelfView: getHideSelfView(state),
        _isChatOpen: isChatOpen,
        _isDisplayNameVisible: isDisplayNameVisible(state),
        _isScreenSharing: Boolean(isLocalScreenshareOnLargeVideo),
        _isLocalScreenShare: Boolean(isLocalScreenShare),
        _isHasSharingScreen: hasScreenShare,
        _largeVideoParticipantId: largeVideoParticipant?.id ?? "",
        _localParticipantId: localParticipant?.id ?? "",
        _noAutoPlayVideo: Boolean(testingConfig?.noAutoPlayVideo),
        _resizableFilmstrip: isFilmstripResizable(state),
        _seeWhatIsBeingShared: Boolean(seeWhatIsBeingShared),
        _showDominantSpeakerBadge: !hideDominantSpeakerBadge,
        _showSubtitles:
            areClosedCaptionsEnabled(state) && Boolean(state["features/base/settings"].showSubtitlesOnStage),
        _verticalFilmstripWidth: verticalFilmstripWidth.current,
        _verticalViewMaxWidth: getVerticalViewMaxWidth(state),
        _visibleFilmstrip: visible,
        _whiteboardEnabled: isWhiteboardEnabled(state),
        _isDominantSpeaker: isDominantSpeaker,
        _tileViewEnabled: isTileView,
        _speakers: speakers,
        _speakerCount: speakerCount,
        _forceChangeLastN: forceChangeLastN,
    };
}

export default connect(_mapStateToProps)(LargeVideo);
