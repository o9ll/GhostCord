/*
 * Nightcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const IS_ELECTRON = typeof process !== "undefined" && process.versions?.electron;

let _electronSession: any = null;

if (IS_ELECTRON) {
    try {
        _electronSession = require("electron").session;
    } catch { }
}

let _ytListenerInstalled = false;

function installAdblockAndFramingRules() {
    if (!IS_ELECTRON || !_electronSession) return;
    try {
        const adPatterns = [
            "*://*.doubleclick.net/*",
            "*://*.googlevideo.com/*oad=*",
            "*://*.googlevideo.com/*adformat=*",
            "*://*.youtube.com/pagead/*",
            "*://*.youtube.com/api/stats/ads*",
            "*://*.youtube.com/ptracking*",
            "*://*.youtube.com/get_midroll_info*",
            "*://*.youtube-nocookie.com/pagead/*",
            "*://*.youtube-nocookie.com/api/stats/ads*",
        ];
        
        // Cancel ad requests
        _electronSession.defaultSession.webRequest.onBeforeRequest({ urls: adPatterns }, (_d: any, cb: any) => cb({ cancel: true }));

        // Spoof Referer and Origin for YouTube requests
        _electronSession.defaultSession.webRequest.onBeforeSendHeaders({
            urls: [
                "*://*.youtube.com/*",
                "*://*.youtube-nocookie.com/*",
            ]
        }, (details: any, cb: any) => {
            const headers = { ...details.requestHeaders };
            headers["Referer"] = "https://www.youtube.com/";
            headers["Origin"] = "https://www.youtube.com";
            cb({ requestHeaders: headers });
        });

        // Strip frame restriction headers (X-Frame-Options & CSP) to allow embedding youtube.com in an iframe
        _electronSession.defaultSession.webRequest.onHeadersReceived({
            urls: [
                "*://*.youtube.com/*",
                "*://*.youtube-nocookie.com/*"
            ]
        }, (details: any, cb: any) => {
            const responseHeaders = { ...details.responseHeaders };
            
            // Delete x-frame-options and content-security-policy case-insensitively
            for (const key of Object.keys(responseHeaders)) {
                const lower = key.toLowerCase();
                if (lower === "x-frame-options" || lower === "content-security-policy") {
                    delete responseHeaders[key];
                }
            }
            
            cb({ responseHeaders });
        });
    } catch (e) {
        console.error("[YoutubeInDiscord] setup error:", e);
    }
}

export async function installWatchingTogetherIntercept(_?: any) {
    installAdblockAndFramingRules();

    if (_ytListenerInstalled) return;
    _ytListenerInstalled = true;
}
