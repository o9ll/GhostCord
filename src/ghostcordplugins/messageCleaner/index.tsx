/*
 * Ghostcord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { tPlugin as t } from "@api/pluginI18n";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, Menu, RestAPI, UserStore, ChannelActionCreators, Alerts, showToast, Toasts } from "@webpack/common";
import { isPluginEnabled } from "@api/PluginManager";
import { Channel, Message } from "discord-types/general";

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: t("Enable MessageCleaner plugin"),
        default: true
    },
    targetChannelId: {
        type: OptionType.STRING,
        description: "Channel ID to clean (leave empty to use the context menu)",
        default: ""
    },
    delayBetweenDeletes: {
        type: OptionType.SLIDER,
        description: "Delay between each deletion (ms) — to avoid rate limiting",
        default: 1000,
        markers: [100, 500, 1000, 2000, 5000],
        minValue: 100,
        maxValue: 10000,
        stickToMarkers: false
    },
    batchSize: {
        type: OptionType.SLIDER,
        description: "Number of messages to process per batch",
        default: 50,
        markers: [10, 25, 50, 100],
        minValue: 1,
        maxValue: 100,
        stickToMarkers: false
    },
    showProgress: {
        type: OptionType.BOOLEAN,
        description: "Show progress in real time",
        default: true
    },
    debugMode: {
        type: OptionType.BOOLEAN,
        description: "Debug mode (detailed logs)",
        default: false
    },
    skipSystemMessages: {
        type: OptionType.BOOLEAN,
        description: "Ignore system messages (join/leave, etc.)",
        default: true
    },
    skipReplies: {
        type: OptionType.BOOLEAN,
        description: "Ignore message replies",
        default: false
    },
    maxAge: {
        type: OptionType.SLIDER,
        description: "Maximum message age to delete (days, 0 = no limit)",
        default: 0,
        markers: [0, 1, 7, 30, 90],
        minValue: 0,
        maxValue: 365,
        stickToMarkers: false
    }
});

let isCleaningInProgress = false;
let shouldStopCleaning = false;
let cleaningStats = { total: 0, deleted: 0, failed: 0, skipped: 0, startTime: 0 };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function log(_message: string, _level: "info" | "warn" | "error" = "info") {
    // Silent in production
}

function debugLog(_message: string) {
    // Silent in production
}

function canDeleteMessage(message: Message, currentUserId: string): boolean {
    try {
        if (message.author?.id !== currentUserId) return false;
        if (settings.store.skipSystemMessages && message.type !== 0 && message.type !== 19) return false;

        const isReply = message.type === 19 || !!message.messageReference || !!(message as any).message_reference;
        if (isReply && settings.store.skipReplies) return false;

        if (settings.store.maxAge > 0) {
            let messageTime: number;
            if (typeof message.timestamp === "string") messageTime = new Date(message.timestamp).getTime();
            else if (typeof message.timestamp === "number") messageTime = message.timestamp;
            else return false;

            if (isNaN(messageTime) || messageTime <= 0) return false;
            const messageAge = Date.now() - messageTime;
            const maxAgeMs = settings.store.maxAge * 24 * 60 * 60 * 1000;
            if (messageAge > maxAgeMs) return false;
        }

        return true;
    } catch {
        return false;
    }
}

async function deleteMessage(channelId: string, messageId: string): Promise<boolean> {
    try {
        await RestAPI.del({ url: `/channels/${channelId}/messages/${messageId}` });
        return true;
    } catch (error: any) {
        const statusCode = error?.status || error?.statusCode || "N/A";
        debugLog(`❌ Delete error ${messageId}: status ${statusCode}`);
        return false;
    }
}

async function getChannelMessages(channelId: string, before?: string): Promise<Message[]> {
    try {
        const url = before
            ? `/channels/${channelId}/messages?limit=${settings.store.batchSize}&before=${before}`
            : `/channels/${channelId}/messages?limit=${settings.store.batchSize}`;
        const response = await RestAPI.get({ url });
        if (!response || !response.body) return [];
        return Array.isArray(response.body) ? response.body : [];
    } catch (error: any) {
        const statusCode = error?.status || error?.statusCode || "N/A";
        log(`❌ Error fetching messages: status ${statusCode}`, "error");
        return [];
    }
}

async function cleanChannel(channelId: string) {
    if (!settings.store.enabled || isCleaningInProgress) return;

    try {
        const channel = ChannelStore.getChannel(channelId);
        const currentUserId = UserStore.getCurrentUser()?.id;
        if (!channel || !currentUserId) return;

        const channelName = channel.name || "Private channel";
        log(`🧹 Starting cleanup of "${channelName}"`);

        isCleaningInProgress = true;
        shouldStopCleaning = false;
        cleaningStats = { total: 0, deleted: 0, failed: 0, skipped: 0, startTime: Date.now() };

        let lastMessageId: string | undefined;
        let totalProcessed = 0;

        while (!shouldStopCleaning) {
            try {
                const messages = await getChannelMessages(channelId, lastMessageId);
                if (messages.length === 0) { log("No more messages to process"); break; }

                const validMessages = messages.filter(msg => canDeleteMessage(msg, currentUserId));
                cleaningStats.total += validMessages.length;

                if (validMessages.length === 0) {
                    lastMessageId = messages[messages.length - 1].id;
                    cleaningStats.skipped += messages.length;
                    if (messages.length < settings.store.batchSize) break;
                    continue;
                }

                for (const message of validMessages) {
                    if (shouldStopCleaning) { log("Stop requested by user"); break; }

                    const success = await deleteMessage(channelId, message.id);
                    if (success) cleaningStats.deleted++;
                    else cleaningStats.failed++;

                    totalProcessed++;
                    if (settings.store.delayBetweenDeletes > 0) {
                        await new Promise(resolve => setTimeout(resolve, settings.store.delayBetweenDeletes));
                    }
                }

                cleaningStats.skipped += messages.filter(msg => !canDeleteMessage(msg, currentUserId)).length;
                lastMessageId = messages[messages.length - 1].id;
                if (messages.length < settings.store.batchSize) break;

            } catch (error: any) {
                const statusCode = error?.status || error?.statusCode || "N/A";
                log(`❌ Error in loop: status ${statusCode}`, "error");
                cleaningStats.failed++;

                if (statusCode === 429) {
                    log("Rate limit reached, pausing 30s...", "warn");
                    await new Promise(resolve => setTimeout(resolve, 30000));
                } else {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }

                if (cleaningStats.failed > 15) { log("Too many errors, stopping", "error"); break; }
            }
        }

        isCleaningInProgress = false;
        const { deleted, failed, skipped } = cleaningStats;
        const totalTime = Date.now() - cleaningStats.startTime;
        const timeStr = totalTime < 60000 ? `${Math.round(totalTime / 1000)}s` : `${Math.round(totalTime / 60000)}min`;
        log(`✅ Cleanup finished: ${deleted} deleted, ${failed} failed, ${skipped} skipped — ${timeStr}`);

    } catch (error) {
        isCleaningInProgress = false;
        log(`❌ Global error: ${error}`, "error");
    }
}

async function cleanGuild(guildId: string) {
    if (!settings.store.enabled || isCleaningInProgress) return;

    try {
        const currentUserId = UserStore.getCurrentUser()?.id;
        if (!currentUserId) return;

        log(`🧹 Starting cleanup of guild ${guildId}`);

        isCleaningInProgress = true;
        shouldStopCleaning = false;
        cleaningStats = { total: 0, deleted: 0, failed: 0, skipped: 0, startTime: Date.now() };

        let maxId: string | undefined;
        let totalProcessed = 0;

        while (!shouldStopCleaning) {
            try {
                let url = `/guilds/${guildId}/messages/search?author_id=${currentUserId}`;
                if (maxId) url += `&max_id=${maxId}`;

                const response = await RestAPI.get({ url });
                if (!response || !response.body || !response.body.messages || response.body.messages.length === 0) {
                    log("No more messages to process in the guild");
                    break;
                }

                let messages: any[] = [];
                for (const group of response.body.messages) {
                    for (const msg of group) {
                        if (msg.author && msg.author.id === currentUserId) {
                            messages.push(msg);
                        }
                    }
                }

                // Unique messages
                const uniqueMsgs = [];
                const seen = new Set();
                for (const m of messages) {
                    if (!seen.has(m.id)) {
                        seen.add(m.id);
                        uniqueMsgs.push(m);
                    }
                }
                messages = uniqueMsgs;

                if (messages.length === 0) {
                    log("No messages found in this batch.");
                    break; // or continue with offset? max_id should guarantee progress if we set it properly
                }

                // Find oldest ID for next pagination
                let oldestId = messages[0].id;
                for (const m of messages) {
                    if (BigInt(m.id) < BigInt(oldestId)) {
                        oldestId = m.id;
                    }
                }
                maxId = (BigInt(oldestId) - 1n).toString();

                const validMessages = messages.filter(msg => canDeleteMessage(msg, currentUserId));
                cleaningStats.total += validMessages.length;

                if (validMessages.length === 0) {
                    cleaningStats.skipped += messages.length;
                    continue;
                }

                for (const message of validMessages) {
                    if (shouldStopCleaning) { log("Stop requested by user"); break; }

                    const channelId = message.channel_id;
                    if (!channelId) continue;

                    const success = await deleteMessage(channelId, message.id);
                    if (success) cleaningStats.deleted++;
                    else cleaningStats.failed++;

                    totalProcessed++;
                    if (settings.store.delayBetweenDeletes > 0) {
                        await new Promise(resolve => setTimeout(resolve, settings.store.delayBetweenDeletes));
                    }
                }

                cleaningStats.skipped += messages.filter(msg => !canDeleteMessage(msg, currentUserId)).length;

            } catch (error: any) {
                const statusCode = error?.status || error?.statusCode || "N/A";
                log(`❌ Error in guild loop: status ${statusCode}`, "error");
                cleaningStats.failed++;

                if (statusCode === 429) {
                    log("Rate limit reached, pausing 30s...", "warn");
                    await new Promise(resolve => setTimeout(resolve, 30000));
                } else if (statusCode === 403 || statusCode === 400) {
                    log("Failed to search in this guild (permissions?)", "error");
                    break;
                } else {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }

                if (cleaningStats.failed > 15) { log("Too many errors, stopping", "error"); break; }
            }
        }

        isCleaningInProgress = false;
        const { deleted, failed, skipped } = cleaningStats;
        const totalTime = Date.now() - cleaningStats.startTime;
        const timeStr = totalTime < 60000 ? `${Math.round(totalTime / 1000)}s` : `${Math.round(totalTime / 60000)}min`;
        log(`✅ Guild cleanup finished: ${deleted} deleted, ${failed} failed, ${skipped} skipped — ${timeStr}`);

    } catch (error) {
        isCleaningInProgress = false;
        log(`❌ Global guild error: ${error}`, "error");
    }
}

function stopCleaning() {
    if (isCleaningInProgress) {
        shouldStopCleaning = true;
        log("⏹️ Stop cleaning requested");
    }
}

async function closeChannelReliably(channelId: string): Promise<boolean> {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            await RestAPI.del({ url: `/channels/${channelId}` });
            return true;
        } catch (e: any) {
            const status = e?.status || e?.statusCode;
            if (status === 429) {
                const retryAfter = e?.body?.retry_after ?? 1.5;
                const delay = retryAfter < 100 ? retryAfter * 1000 : retryAfter;
                await new Promise(r => setTimeout(r, delay + 100));
            } else {
                console.error(`[MessageCleaner] Failed to close channel ${channelId}:`, e);
                return false;
            }
        }
    }
    return false;
}

async function clearAllDMs() {
    const channels = Object.values(ChannelStore.getMutablePrivateChannels()).filter((c: any) => c.type === 1);
    if (channels.length === 0) {
        showToast(t("No DMs to close"), Toasts.Type.INFO);
        return;
    }

    Alerts.show({
        title: t("Close all DMs"),
        confirmText: t("Close"),
        cancelText: t("Cancel"),
        body: (
            <div style={{ color: "#dbdee1" }}>
                {t("Are you sure you want to close all your DMs? Your messages will not be deleted, but the conversations will disappear from your list.")}
            </div>
        ),
        onConfirm: async () => {
            showToast(`Closing ${channels.length} DMs...`, Toasts.Type.INFO);
            let closedCount = 0;
            for (const ch of channels) {
                const success = await closeChannelReliably(ch.id);
                if (success) closedCount++;
                await new Promise(r => setTimeout(r, 100));
            }
            showToast(`Closed ${closedCount}/${channels.length} DMs`, Toasts.Type.SUCCESS);
        }
    });
}

async function clearAllGroups() {
    const channels = Object.values(ChannelStore.getMutablePrivateChannels()).filter((c: any) => c.type === 3);
    if (channels.length === 0) {
        showToast(t("No groups to leave"), Toasts.Type.INFO);
        return;
    }

    Alerts.show({
        title: t("Leave all groups"),
        confirmText: t("Leave"),
        cancelText: t("Cancel"),
        body: (
            <div style={{ color: "#dbdee1" }}>
                {t("Are you sure you want to leave all your group DMs? This will remove you from all group conversations.")}
            </div>
        ),
        onConfirm: async () => {
            showToast(`Leaving ${channels.length} groups...`, Toasts.Type.INFO);
            let leftCount = 0;
            for (const ch of channels) {
                const success = await closeChannelReliably(ch.id);
                if (success) leftCount++;
                await new Promise(r => setTimeout(r, 100));
            }
            showToast(`Left ${leftCount}/${channels.length} groups`, Toasts.Type.SUCCESS);
        }
    });
}

const ChannelContextMenuPatch: NavContextMenuPatchCallback = (children, ctx: { channel?: Channel; } = {}) => {
    const { channel } = ctx;
    if (!channel) return;

    const group = findGroupChildrenByChildId("mark-channel-read", children) ?? children;
    if (!group) return;

    const menuItems: any[] = [<Menu.MenuSeparator key="separator" />];

    if (isCleaningInProgress) {
        const { total, deleted, failed, skipped } = cleaningStats;
        const processed = deleted + failed + skipped;
        const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

        menuItems.push(
            <Menu.MenuItem key="cleaning-status" id="vc-cleaning-status"
                label={`${t("Cleaning in progress:")} ${percentage}% (${processed}/${total})`}
                color="brand" disabled={true} />,
            <Menu.MenuItem key="stop-cleaning" id="vc-stop-cleaning"
                label={t("Stop cleaning")} color="danger" action={stopCleaning} />
        );
    } else {
        menuItems.push(
            <Menu.MenuItem key="clean-messages" id="vc-clean-messages"
                label={t("Clean messages")} color="danger"
                action={() => cleanChannel(channel.id)} />
        );
        if (isPluginEnabled("ClearDMs")) {
            menuItems.push(
                <Menu.MenuItem key="clear-all-dms" id="vc-clear-all-dms"
                    label={t("Close all DMs")} color="danger"
                    action={clearAllDMs} />
            );
        }
        if (isPluginEnabled("ClearGroups")) {
            menuItems.push(
                <Menu.MenuItem key="clear-all-groups" id="vc-clear-all-groups"
                    label={t("Leave all groups")} color="danger"
                    action={clearAllGroups} />
            );
        }
    }

    group.push(...menuItems);
};

const GuildContextMenuPatch: NavContextMenuPatchCallback = (children, ctx: { guild?: any; } = {}) => {
    const { guild } = ctx;
    if (!guild) return;

    // Discord uses various IDs for guild context menus. We look for a common group like "mark-guild-read" or just append to children.
    const group = findGroupChildrenByChildId("mark-guild-read", children) ?? findGroupChildrenByChildId("hide-muted-channels", children) ?? children;
    if (!group) return;

    const menuItems: any[] = [<Menu.MenuSeparator key="separator-guild" />];

    if (isCleaningInProgress) {
        const { total, deleted, failed, skipped } = cleaningStats;
        const processed = deleted + failed + skipped;
        const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

        menuItems.push(
            <Menu.MenuItem key="cleaning-status-guild" id="vc-cleaning-status-guild"
                label={`${t("Cleaning in progress:")} ${percentage}% (${processed}/${total})`}
                color="brand" disabled={true} />,
            <Menu.MenuItem key="stop-cleaning-guild" id="vc-stop-cleaning-guild"
                label={t("Stop cleaning")} color="danger" action={stopCleaning} />
        );
    } else {
        menuItems.push(
            <Menu.MenuItem key="clean-guild-messages" id="vc-clean-guild-messages"
                label={t("Clean all my messages")} color="danger"
                action={() => cleanGuild(guild.id)} />
        );
    }

    group.push(...menuItems);
};

export default definePlugin({
    name: "MessageCleaner",
    enabledByDefault: true,
    description: "Cleans all messages in a channel with smart rate limiting and statistics",
    authors: [{ name: "Bash",
     id: 1327483363518582784n }],
    dependencies: ["ContextMenuAPI"],
    settings,

    contextMenus: {
        "channel-context": ChannelContextMenuPatch,
        "gdm-context": ChannelContextMenuPatch,
        "user-context": ChannelContextMenuPatch,
        "guild-context": GuildContextMenuPatch
    },

    start() {
        log("🚀 MessageCleaner plugin started");
    },

    stop() {
        log("🛑 MessageCleaner plugin stopped");
        if (isCleaningInProgress) shouldStopCleaning = true;
    }
});
