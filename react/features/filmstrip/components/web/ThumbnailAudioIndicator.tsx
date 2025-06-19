import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import AudioLevelIndicator from '../../../audio-level-indicator/components/AudioLevelIndicator';
import JitsiMeetJS from '../../../base/lib-jitsi-meet';
import { getCurrentConference } from '../../../base/conference/functions';
import { dominantSpeakerChanged } from '../../../base/participants/actions';
import { getLocalParticipant, getDominantSpeakerParticipant } from '../../../base/participants/functions';
import { IReduxState, IStore } from '../../../app/types';
import { ITrack } from '../../../base/tracks/types';

const JitsiTrackEvents = JitsiMeetJS.events.track;

interface IProps {

    /**
     * The audio track related to the participant.
     */
    _audioTrack?: ITrack;

    /**
     * The participant ID.
     */
    participantId?: string;
}

const ThumbnailAudioIndicator = ({
    _audioTrack,
    participantId
}: IProps) => {
    const [audioLevel, setAudioLevel] = useState(0);
    const dispatch = useDispatch<IStore['dispatch']>();
    const state = useSelector((state: IReduxState) => state);

    useEffect(() => {
        setAudioLevel(0);
        if (_audioTrack) {
            const { jitsiTrack } = _audioTrack;

            const handleAudioLevelChanged = (level: number) => {
                setAudioLevel(level);

                // 오디오 레벨이 0.1 이상일 때 dominant speaker 이벤트 강제 호출
                if (level >= 0.1 && participantId) {
                    const conference = getCurrentConference(state);
                    const localParticipant = getLocalParticipant(state);

                    // 로컬 참가자가 아닌 경우에만 dominant speaker로 설정
                    if (localParticipant && localParticipant.id !== participantId && conference) {
                        // speakersList에서 실제로 말했던 스피커들의 ID 리스트를 가져옴
                        const speakersList = state['features/base/participants'].speakersList;
                        const previousSpeakers = Array.from(speakersList.keys());

                        dispatch(dominantSpeakerChanged(
                            participantId,
                            previousSpeakers,
                            false, // silence
                            conference
                        ));
                    }
                }
            };

            jitsiTrack?.on(JitsiTrackEvents.TRACK_AUDIO_LEVEL_CHANGED, handleAudioLevelChanged);

            return () => {
                jitsiTrack?.off(JitsiTrackEvents.TRACK_AUDIO_LEVEL_CHANGED, handleAudioLevelChanged);
            };
        }
    }, [_audioTrack, participantId, dispatch, state]);

    return (
        <span className='audioindicator-container'>
            <AudioLevelIndicator audioLevel={audioLevel} />
        </span>
    );
};

export default ThumbnailAudioIndicator;
