// @ts-ignore
import { safeJsonParse } from "@jitsi/js-utils/json";
import CryptoJS from "crypto-js";
import { reportError } from "./helpers";

/**
 * A list if keys to ignore when parsing.
 *
 * @type {string[]}
 */
const blacklist = ["__proto__", "constructor", "prototype"];

// 환경변수에서 SECRET_KEY를 가져옵니다
const SECRET_KEY = process.env.JITSI_SECRET_KEY;

// SECRET_KEY가 설정되지 않은 경우 에러를 발생시킵니다
if (!SECRET_KEY) {
    console.error("JITSI_SECRET_KEY environment variable is not set");
    console.log("Current process.env:", process.env);
}

/**
 * Decrypts an encrypted string using AES
 *
 * @param {string} encrypted - The encrypted string to decrypt
 * @returns {string} The decrypted string
 */
export function decrypt(encrypted: string): string {
    try {
        const decrypted = CryptoJS.AES.decrypt(encrypted, SECRET_KEY || "");
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
        console.error("Decryption failed:", error);
        return "";
    }
}

/**
 * Parses the query/search or fragment/hash parameters out of a specific URL and
 * returns them as a JS object.
 *
 * @param {URL} url - The URL to parse.
 * @param {boolean} dontParse - If falsy, some transformations (for parsing the
 * value as JSON) will be executed.
 * @param {string} source - If {@code 'search'}, the parameters will parsed out
 * of {@code url.search}; otherwise, out of {@code url.hash}.
 * @returns {Object}
 */
export function parseURLParams(url: URL | string, dontParse = false, source = "hash") {
    if (!url) {
        return {};
    }

    if (typeof url === "string") {
        // eslint-disable-next-line no-param-reassign
        url = new URL(url);
    }
    const paramStr = source === "search" ? url.search : url.hash;
    const params: any = {};
    const paramParts = paramStr?.substr(1).split("&") || [];

    // Detect and ignore hash params for hash routers.
    if (source === "hash" && paramParts.length === 1) {
        const firstParam = paramParts[0];

        if (firstParam.startsWith("/") && firstParam.split("&").length === 1) {
            return params;
        }
    }

    paramParts.forEach((part: string) => {
        const param = part.split("=");
        const key = param[0];

        if (!key || key.split(".").some((k: string) => blacklist.includes(k))) {
            return;
        }

        let value;

        try {
            // 첫 번째 = 이후의 모든 문자열을 값으로 사용
            value = part.substring(key.length + 1);

            if (!dontParse) {
                const decoded = decodeURIComponent(value)
                    .replace(/\\&/, "&")
                    .replace(/[\u2018\u2019]/g, "'")
                    .replace(/[\u201C\u201D]/g, '"');

                // config.authToken과 config.userId는 JSON 파싱을 시도하지 않음
                if (key === "config.authToken" || key === "config.userId") {
                    value = decoded;
                } else {
                    value = decoded === "undefined" ? undefined : safeJsonParse(decoded);
                }
            }
        } catch (e: any) {
            reportError(e, `Failed to parse URL parameter value: ${String(value)}`);

            return;
        }
        params[key] = value;
    });

    return params;
}

/**
 * Parses and decrypts URL parameters
 *
 * @param {URL} url - The URL to parse
 * @returns {Object} The parsed and decrypted parameters
 */
export function parseAndDecryptURLParams(authToken: string, userId: string) {
    // dontParse를 true로 설정하여 JSON 파싱을 시도하지 않도록 함
    const decryptedParams: any = {};
    decryptedParams.authToken = decrypt(authToken);
    decryptedParams.userId = decrypt(userId);

    return decryptedParams;
}
