import { getBackendSafeRoomName } from '../util/uri';
import { doGetJSON } from '../util/httpUtils';
import logger from './logger';

const API_BASE_URL = 'https://api.glob-dev.kong.yk8s.me/api';

// 코스 정보를 캐시하기 위한 Map
const courseCache = new Map<string, string>();

/**
 * 코스 제목을 가져오거나 캐시된 값을 반환합니다.
 *
 * @param {string} courseId - 코스 ID
 * @returns {Promise<string | null>} 코스 제목 또는 null
 */
async function getCourseTitle(courseId: string): Promise<string | null> {
    // 캐시에서 먼저 확인
    if (courseCache.has(courseId)) {
        return courseCache.get(courseId) || null;
    }

    try {
        const url = `${API_BASE_URL}/course/v1/courses/${encodeURIComponent(courseId)}`;
        logger.info(`Fetching course data from: ${url}`);

        const response = await doGetJSON(url);

        if (response && response.title) {
            // 캐시에 저장
            courseCache.set(courseId, response.title);
            logger.info(`Successfully fetched course: ${response.title}`);
            return response.title;
        } else {
            logger.warn('Course response is invalid or missing title');
            return null;
        }
    } catch (error) {
        logger.error('Failed to fetch course data:', error);
        return null;
    }
}

/**
 * Builds and returns the room name.
 *
 * @returns {string}
 */
export default function getRoomName(): string | undefined {
    const path = window.location.pathname;

    // The last non-directory component of the path (name) is the room.
    const roomName = path.substring(path.lastIndexOf('/') + 1) || undefined;

    return getBackendSafeRoomName(roomName);
}

/**
 * Path에서 방명을 가져와서 API 호출하여 코스 제목으로 변환합니다.
 *
 * @returns {Promise<string | undefined>}
 */
export async function getRoomNameFromPathWithCourseInfo(): Promise<string | undefined> {
    const path = window.location.pathname;

    // The last non-directory component of the path (name) is the room.
    const roomName = path.substring(path.lastIndexOf('/') + 1) || undefined;

    if (!roomName) {
        return undefined;
    }

    // 코스 제목을 가져오기 시도
    const courseTitle = await getCourseTitle(roomName);

    if (courseTitle) {
        logger.info(`Using course title as room name: ${courseTitle}`);
        return getBackendSafeRoomName(courseTitle);
    }

    // 코스 제목을 가져올 수 없는 경우 원래 방명 사용
    return getBackendSafeRoomName(roomName);
}
