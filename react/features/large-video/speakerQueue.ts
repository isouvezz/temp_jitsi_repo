import { SPEAKER_QUEUE_UPDATED } from "./actionTypes";
import { JitsiTrackEvents } from "../base/lib-jitsi-meet";

interface SpeakerEntry {
    id: string;
    timestamp: number;
    audioLevel: number;
}

class SpeakerQueue {
    private queue: SpeakerEntry[] = [];
    private timer: number | null = null;
    private readonly MAX_QUEUE_SIZE = 4;
    private readonly EXPIRATION_TIME = 15000; // 15초
    private readonly AUDIO_LEVEL_THRESHOLD = 0.1; // 오디오 레벨 임계값
    private dispatchCallback: ((action: any) => void) | null = null;
    private trackListeners: Map<string, Function> = new Map();

    setDispatchCallback(callback: (action: any) => void): void {
        this.dispatchCallback = callback;
    }

    addSpeaker(speakerId: string, audioLevel: number = 0): void {
        const existingSpeaker = this.queue.find((s) => s.id === speakerId);

        if (existingSpeaker) {
            const oldTimestamp = existingSpeaker.timestamp;
            existingSpeaker.timestamp = Date.now();
            existingSpeaker.audioLevel = audioLevel;
            console.log(
                `[SpeakerQueue] Speaker ${speakerId} updated - Old time: ${new Date(
                    oldTimestamp
                ).toISOString()}, New time: ${new Date(existingSpeaker.timestamp).toISOString()}, Level: ${audioLevel}`
            );
        } else {
            if (this.queue.length >= this.MAX_QUEUE_SIZE) {
                this.queue.shift();
            }
            this.queue.push({
                id: speakerId,
                timestamp: Date.now(),
                audioLevel,
            });
            console.log(
                `[SpeakerQueue] New speaker ${speakerId} added - Time: ${new Date(
                    Date.now()
                ).toISOString()}, Level: ${audioLevel}`
            );
        }

        this.updateReduxState();
        this.startTimer();
    }

    updateAudioLevel(speakerId: string, audioLevel: number): void {
        const speaker = this.queue.find((s) => s.id === speakerId);
        if (speaker) {
            speaker.audioLevel = audioLevel;
            speaker.timestamp = Date.now();
            this.updateReduxState();
        }
    }

    private updateReduxState(): void {
        if (this.dispatchCallback) {
            this.dispatchCallback({
                type: SPEAKER_QUEUE_UPDATED,
                queue: this.queue.map((entry) => ({
                    id: entry.id,
                    timestamp: entry.timestamp,
                    audioLevel: entry.audioLevel,
                })),
            });
        }
    }

    private startTimer(): void {
        if (this.timer === null) {
            this.timer = window.setInterval(() => {
                const now = Date.now();
                const expiredSpeakers = this.queue.filter((s) => now - s.timestamp > this.EXPIRATION_TIME);

                if (expiredSpeakers.length > 0) {
                    expiredSpeakers.forEach((speaker) => {
                        console.log(
                            `[SpeakerQueue] Speaker ${speaker.id} expired - Last active: ${new Date(
                                speaker.timestamp
                            ).toISOString()}, Current: ${new Date(now).toISOString()}`
                        );
                    });
                    this.queue = this.queue.filter((s) => now - s.timestamp <= this.EXPIRATION_TIME);
                    this.updateReduxState();
                }

                if (this.queue.length === 0) {
                    this.stopTimer();
                }
            }, 1000);
        }
    }

    private stopTimer(): void {
        if (this.timer !== null) {
            window.clearInterval(this.timer);
            this.timer = null;
        }
    }

    getActiveSpeakers(): string[] {
        return this.queue.map((s) => s.id);
    }

    getSpeakerCount(): number {
        return this.queue.length;
    }

    subscribeToTrack(track: any): void {
        if (!track || this.trackListeners.has(track.getId())) {
            return;
        }

        const listener = (audioLevel: number) => {
            if (audioLevel > this.AUDIO_LEVEL_THRESHOLD) {
                this.addSpeaker(track.getParticipantId(), audioLevel);
            }
        };

        this.trackListeners.set(track.getId(), listener);
        track.on(JitsiTrackEvents.TRACK_AUDIO_LEVEL_CHANGED, listener);
    }

    unsubscribeFromTrack(track: any): void {
        if (!track) {
            return;
        }

        const listener = this.trackListeners.get(track.getId());
        if (listener) {
            track.off(JitsiTrackEvents.TRACK_AUDIO_LEVEL_CHANGED, listener);
            this.trackListeners.delete(track.getId());
        }
    }
}

export const speakerQueue = new SpeakerQueue();
