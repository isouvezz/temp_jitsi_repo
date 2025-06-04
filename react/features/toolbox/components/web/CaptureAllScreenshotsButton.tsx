import React from "react";
import { useSelector } from "react-redux";
import { getRemoteParticipants, getLocalParticipant } from "../../../base/participants/functions";
import { getTrackState, getTrackByMediaTypeAndParticipant } from "../../../base/tracks/functions.any";
import { MEDIA_TYPE } from "../../../base/media/constants";
import { IconCameraRefresh } from "../../../base/icons/svg";
import type { IReduxState } from "../../../app/types";
import type { IParticipant } from "../../../base/participants/types";
import type { ITrack } from "../../../base/tracks/types";

const CaptureAllScreenshotsButton = () => {
    // 리덕스에서 필요한 정보 가져오기
    const localParticipant = useSelector(getLocalParticipant);
    const remoteParticipants = useSelector(getRemoteParticipants);
    const tracks = useSelector((state: IReduxState) => getTrackState(state));

    // 비디오 트랙에서 비디오 엘리먼트 찾기 및 캡처
    const handleCapture = async () => {
        try {
            // 모든 참가자(로컬+리모트) 리스트 생성
            const allParticipants: IParticipant[] = [
                ...(localParticipant ? [localParticipant] : []),
                ...Array.from(remoteParticipants.values()),
            ];

            let capturedCount = 0;

            for (const participant of allParticipants) {
                // 가짜 참가자(화면공유 등) 제외
                if (participant.fakeParticipant) continue;

                // 비디오 트랙 찾기
                const videoTrack: ITrack | undefined = getTrackByMediaTypeAndParticipant(
                    tracks,
                    MEDIA_TYPE.VIDEO,
                    participant.id
                );
                if (!videoTrack || !videoTrack.jitsiTrack) continue;

                // 트랙의 실제 MediaStreamTrack id 얻기
                const jitsiTrack = videoTrack.jitsiTrack;
                let mediaStreamTrack: MediaStreamTrack | null = null;
                if (typeof jitsiTrack.getOriginalStream === "function") {
                    const stream = jitsiTrack.getOriginalStream();
                    if (stream && stream.getVideoTracks) {
                        const tracks = stream.getVideoTracks();
                        if (tracks && tracks.length > 0) {
                            mediaStreamTrack = tracks[0];
                        }
                    }
                } else if (typeof jitsiTrack.getTrack === "function") {
                    mediaStreamTrack = jitsiTrack.getTrack();
                }
                if (!mediaStreamTrack) continue;

                // video 엘리먼트들 중 srcObject의 트랙 id와 비교
                const videoElems = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[];
                let videoElem: HTMLVideoElement | undefined;
                for (const elem of videoElems) {
                    const stream = elem.srcObject as MediaStream;
                    if (stream) {
                        const tracks = stream.getVideoTracks();
                        if (tracks.some((t) => t.id === mediaStreamTrack!.id)) {
                            videoElem = elem;
                            break;
                        }
                    }
                }
                if (!videoElem || videoElem.readyState < 2) continue;

                // 캔버스에 그리기
                const canvas = document.createElement("canvas");
                canvas.width = videoElem.videoWidth;
                canvas.height = videoElem.videoHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) continue;
                ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
                const img = canvas.toDataURL("image/png");

                // 다운로드 링크 생성 및 클릭
                const a = document.createElement("a");
                a.href = img;
                a.download = `${participant.name || participant.displayName || participant.id}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                capturedCount++;
            }

            if (capturedCount === 0) {
                alert("캡처할 참가자 비디오가 없습니다.");
            }
        } catch (err) {
            // eslint-disable-next-line no-alert
            alert("화면 캡처 중 오류가 발생했습니다.");
            // eslint-disable-next-line no-console
            console.error(err);
        }
    };

    return (
        <button className="toolbox-button" onClick={handleCapture} title="모든 참가자 화면 캡처" type="button">
            <IconCameraRefresh />
        </button>
    );
};

export default CaptureAllScreenshotsButton;
