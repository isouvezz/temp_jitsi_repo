import { SPEAKER_QUEUE_UPDATED } from "./actionTypes";

interface SpeakerEntry {
    id: string;
    timestamp: number;
}

class SpeakerQueue {
    private queue: SpeakerEntry[] = [];
    private timer: number | null = null;
    private readonly MAX_QUEUE_SIZE = 4;
    private readonly EXPIRATION_TIME = 15000; // 15초
    private dispatchCallback: ((action: any) => void) | null = null;

    setDispatchCallback(callback: (action: any) => void): void {
        this.dispatchCallback = callback;
    }

    addSpeaker(speakerId: string): void {
        // 이미 존재하는 화자인 경우 타임스탬프만 업데이트
        const existingIndex = this.queue.findIndex((entry) => entry.id === speakerId);
        if (existingIndex !== -1) {
            this.queue[existingIndex].timestamp = Date.now();
            this.updateReduxState();
            console.log("addSpeaker", "update timestamp", this.queue.length);
            return;
        }

        // 큐가 가득 찬 경우 가장 오래된 항목 제거
        if (this.queue.length >= this.MAX_QUEUE_SIZE) {
            console.log("addSpeaker", "shift speaker", this.queue.length);
            this.queue.shift();
        }

        // 새로운 화자 추가
        this.queue.push({
            id: speakerId,
            timestamp: Date.now(),
        });

        this.updateReduxState();
        this.startTimer();

        console.log("addSpeaker", "this.queue.length", this.queue.length);
    }

    private updateReduxState(): void {
        if (this.dispatchCallback) {
            this.dispatchCallback({
                type: SPEAKER_QUEUE_UPDATED,
                payload: {
                    speakers: this.queue.map((entry) => entry.id),
                    speakerCount: this.queue.length,
                },
            });
        }
    }

    private startTimer(): void {
        if (this.timer === null) {
            this.timer = window.setInterval(() => {
                const now = Date.now();
                const expiredCount = this.queue.filter((entry) => now - entry.timestamp > this.EXPIRATION_TIME).length;

                if (expiredCount > 0) {
                    this.queue = this.queue.filter((entry) => now - entry.timestamp <= this.EXPIRATION_TIME);
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
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    getActiveSpeakers(): string[] {
        return this.queue.map((entry) => entry.id);
    }

    getSpeakerCount(): number {
        return this.queue.length;
    }
}

export const speakerQueue = new SpeakerQueue();
