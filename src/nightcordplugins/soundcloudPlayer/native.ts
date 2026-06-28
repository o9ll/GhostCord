/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BrowserWindow, IpcMainInvokeEvent, ipcMain, net } from "electron";

// ─── Fetch via net.fetch d'Electron ──────────────────────────────────────────

async function netGet(url: string, headers?: Record<string, string>): Promise<string> {
    const resp = await net.fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Referer": "https://soundcloud.com/",
            ...(headers ?? {}),
        }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.text();
}

// ─── Fetch dynamique du client_id SoundCloud ─────────────────────────────────
// Même logique que sc_fetch_client_id / sc_parse_js_for_clientid en C :
//   Étape 1 : GET soundcloud.com → extraire les <script src="...">
//   Étape 2 : GET le dernier bundle JS → chercher client_id:"XXXXXXXX"

export async function fetchSoundCloudClientId(_: IpcMainInvokeEvent): Promise<string | null> {
    try {
        // Étape 1 : charger soundcloud.com
        const html = await netGet("https://soundcloud.com/", {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        });

        // Extraire les URLs des bundles JS
        const scriptUrls: string[] = [];
        const re = /<script[^>]+src="(https:\/\/[^"]+\.js[^"]*)"[^>]*>/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(html)) !== null) {
            const url = m[1];
            if (!url.includes("cookielaw") && !url.includes("analytics") && !url.includes("st-f"))
                scriptUrls.push(url);
        }

        if (scriptUrls.length === 0) return null;

        // Étape 2 : tester les bundles JS (on cherche dans les plus récents)
        for (const jsUrl of scriptUrls.slice(-5).reverse()) {
            try {
                const js = await netGet(jsUrl);

                // Patterns mis à jour pour 2024/2025
                const patterns = [
                    /client_id\s*:\s*"([a-zA-Z0-9]{32})"/,
                    /client_id\s*=\s*"([a-zA-Z0-9]{32})"/,
                    /client_id\s*:\s*'([a-zA-Z0-9]{32})'/,
                    /client_id\s*=\s*'([a-zA-Z0-9]{32})'/,
                    /"client_id"\s*:\s*"([a-zA-Z0-9]{32})"/,
                ];
                for (const pat of patterns) {
                    const match = js.match(pat);
                    if (match?.[1]) return match[1];
                }
            } catch { /* essayer le suivant */ }
        }

        return null;
    } catch (e: any) {
        console.error("[SoundCloudPlayer] fetchClientId error:", e?.message);
        return null;
    }
}

// ─── Recherche de pistes ──────────────────────────────────────────────────────

export async function searchSoundCloud(
    _: IpcMainInvokeEvent,
    query: string,
    clientId: string
): Promise<string | null> {
    try {
        const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=20`;
        return await netGet(url);
    } catch (e: any) {
        // Retourner le code HTTP pour détecter l'expiration du client_id
        throw new Error(e?.message ?? String(e));
    }
}

// ─── Résolution de l'URL de stream ───────────────────────────────────────────

export async function resolveStreamUrl(_: IpcMainInvokeEvent, url: string, clientId: string): Promise<string | null> {
    try {
        // Ajouter le client_id à l'URL de stream si absent
        const streamUrl = new URL(url);
        streamUrl.searchParams.set("client_id", clientId);

        // On fait un fetch manuel en suivant les redirections pour obtenir l'URL finale
        const resp = await net.fetch(streamUrl.toString(), {
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "*/*",
                "Referer": "https://soundcloud.com/",
            }
        });

        if (!resp.ok) {
            console.error(`[SoundCloudNative] Stream resolution failed: ${resp.status}`);
            return null;
        }

        // Si c'est un flux HLS (m3u8), l'API renvoie un JSON contenant l'URL réelle
        const text = await resp.text();
        try {
            const json = JSON.parse(text);
            return json.url || null;
        } catch {
            // Si ce n'est pas du JSON, c'est peut-être déjà l'URL directe (cas rare)
            return resp.url;
        }
    } catch (e: any) {
        console.error("[SoundCloudNative] resolveStreamUrl error:", e?.message);
        return null;
    }
}

export async function resolveTrack(
    _: IpcMainInvokeEvent,
    trackId: string,
    clientId: string
): Promise<string | null> {
    try {
        const url = `https://api-v2.soundcloud.com/tracks/${trackId}?client_id=${clientId}`;
        return await netGet(url);
    } catch (e: any) {
        throw new Error(e?.message ?? String(e));
    }
}

// ─── Listening Together ─────────────────────────────────────────────────────────────────
// When someone clicks "Listening Together" button on Discord, it tries to open
// https://nightcord.st/listen?sc_id=TRACK_ID in the browser.
// We intercept that before it leaves Discord and emit an IPC event to the renderer.

const LISTEN_URL_PREFIX = "https://nightcord.st/listen?";

export function setupListeningTogetherHandler(_: IpcMainInvokeEvent): void {
    // no-op: real setup happens at plugin start via setupListeningTogther()
}

let _listenerInstalled = false;

export function installListeningTogetherIntercept(_: IpcMainInvokeEvent): void {
    if (_listenerInstalled) return;
    _listenerInstalled = true;

    // Hook all existing and future BrowserWindows
    const hook = (win: Electron.BrowserWindow) => {
        const origHandler = win.webContents.getWindowOpenHandler?.();
        win.webContents.setWindowOpenHandler(details => {
            if (details.url.startsWith(LISTEN_URL_PREFIX)) {
                try {
                    const params = new URL(details.url).searchParams;
                    const scId = params.get("sc_id") ?? "";
                    const scUrl = params.get("sc_url") ?? "";
                    // Send to all renderer windows via CustomEvent
                    // Security: use JSON.stringify to safely escape scId and prevent XSS injection
                    BrowserWindow.getAllWindows().forEach(w => {
                        try { 
                            const safeId = JSON.stringify(scId);
                            w.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent('soundcord-listen-together', { detail: { scId: ${safeId} } }))`).catch(() => {});
                        } catch { }
                    });
                } catch { }
                return { action: "deny" };
            }
            // Fall through to original handler
            if (origHandler) return origHandler(details);
            return { action: "deny" };
        });
    };

    BrowserWindow.getAllWindows().forEach(hook);
    (require("electron") as typeof import("electron")).app.on("browser-window-created" as any, (_e: any, win: Electron.BrowserWindow) => hook(win));
}
