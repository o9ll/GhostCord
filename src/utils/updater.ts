/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "./Logger";
import { IpcRes } from "./types";

export const UpdateLogger = /* #__PURE__ */ new Logger("Updater", "white");
export let isOutdated = false;
export const isNewer = false;
export let updateError: any;
export let changes: Record<"hash" | "author" | "message", string>[] = [];

async function Unwrap<T>(p: Promise<IpcRes<T>>): Promise<T> {
    const res = await p;
    if (res.ok) return res.value as T;
    updateError = res.error;
    throw res.error;
}

/**
 * Ask the main process if there's a newer version.
 * Updates isOutdated and changes.
 */
export async function checkForUpdates(): Promise<boolean> {
    changes = await Unwrap(VencordNative.updater.getUpdates());
    return (isOutdated = changes.length > 0);
}

/**
 * Download the Setup.exe (step 1).
 * Returns true if the download succeeded.
 */
export async function update(): Promise<boolean> {
    if (!isOutdated) return true;
    const ok = await Unwrap(VencordNative.updater.update());
    if (ok) isOutdated = false;
    return ok;
}

/**
 * Launch the downloaded installer (step 2).
 * The app will close and restart automatically after installation.
 */
export async function rebuild(): Promise<boolean> {
    return Unwrap(VencordNative.updater.rebuild());
}

import { Settings } from "@api/Settings";

export const getRepo = () => Unwrap(VencordNative.updater.getRepo());

/**
 * Check for updates on startup and prompt the user to update.
 */
export async function maybePromptToUpdate(confirmMessage: string, checkForDev = false) {
    if (IS_WEB || IS_UPDATER_DISABLED || Settings.disableAutoUpdate) return;
    if (checkForDev && IS_DEV) return;

    try {
        const outdated = await checkForUpdates();
        if (outdated) {
            // Auto-update without confirmation
            const downloaded = await update();
            if (downloaded) await rebuild();
        }
    } catch (err) {
        UpdateLogger.error(err);
        alert("Update check failed. Check your connection or reinstall Ghostcord.");
    }
}
