/*
 * Ghostcord, a Discord client mod
 * Copyright (c) 2026 contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { Message } from "@vencord/discord-types";
import { ChannelStore, MessageStore, showToast, Toasts, Menu, React } from "@webpack/common";

interface MessageContextProps {
    message: Message;
    channel: any;
}

interface MediaItem {
    url: string;
    filename: string;
}

const SaveIcon = () => (
    <svg className="vc-ic-save-icon" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path fill="currentColor" d="M12 2a1 1 0 0 1 1 1v10.59l3.3-3.3a1 1 0 1 1 1.4 1.42l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.42l3.3 3.3V3a1 1 0 0 1 1-1ZM3 20a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2H3Z" />
    </svg>
);

function getMediaFromMessage(message: Message): MediaItem[] {
    const media: MediaItem[] = [];
    const seenUrls = new Set<string>();
    
    // Attachments
    if (message.attachments) {
        for (const attachment of message.attachments) {
            const isMedia = attachment.content_type?.startsWith("image/") ||
                            attachment.content_type?.startsWith("video/") || 
                            /\.(mp4|webm|mov|mkv|avi|flv|wmv|png|jpe?g|webp|gif|bmp|tiff|heic)$/i.test(attachment.filename || "");
            if (isMedia && attachment.proxy_url) {
                const url = attachment.proxy_url;
                if (!seenUrls.has(url)) {
                    seenUrls.add(url);
                    media.push({
                        url,
                        filename: attachment.filename || `media_${message.id}`
                    });
                }
            }
        }
    }
    
    // Embeds
    if (message.embeds) {
        let embedIndex = 0;
        for (const embed of message.embeds) {
            // Video embeds
            if (embed.video && embed.video.url) {
                const url = embed.video.url;
                if (!seenUrls.has(url)) {
                    seenUrls.add(url);
                    let filename = "";
                    try {
                        const parsedUrl = new URL(url);
                        filename = parsedUrl.pathname.split("/").pop() || "";
                    } catch {}
                    if (!filename || !/\.(mp4|webm|mov|mkv|avi|flv|wmv|png|jpe?g|webp|gif|bmp|tiff|heic)$/i.test(filename)) {
                        filename = `video_${message.id}_${embedIndex}.mp4`;
                    }
                    media.push({ url, filename });
                    embedIndex++;
                }
            }
            // Image embeds
            if (embed.image && embed.image.url) {
                const url = embed.image.url;
                if (!seenUrls.has(url)) {
                    seenUrls.add(url);
                    let filename = "";
                    try {
                        const parsedUrl = new URL(url);
                        filename = parsedUrl.pathname.split("/").pop() || "";
                    } catch {}
                    if (!filename || !/\.(mp4|webm|mov|mkv|avi|flv|wmv|png|jpe?g|webp|gif|bmp|tiff|heic)$/i.test(filename)) {
                        filename = `image_${message.id}_${embedIndex}.png`;
                    }
                    media.push({ url, filename });
                    embedIndex++;
                }
            }
        }
    }
    
    return media;
}

async function downloadMedia(media: MediaItem[]) {
    if (!media.length) {
        showToast("No media found to download.", Toasts.Type.FAILURE);
        return;
    }
    
    let dir: FileSystemDirectoryHandle;
    try {
        dir = await window.showDirectoryPicker({ mode: "readwrite" });
    } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        console.error("[SaveVideos] Failed to open directory picker:", e);
        return;
    }

    const usedNames = new Map<string, number>();

    function uniqueName(original: string): string {
        const count = usedNames.get(original) ?? 0;
        usedNames.set(original, count + 1);
        if (count === 0) return original;
        const dot = original.lastIndexOf(".");
        return dot === -1
            ? `${original}_${count}`
            : `${original.slice(0, dot)}_${count}${original.slice(dot)}`;
    }

    const tasks = media.map(v => ({ url: v.url, filename: uniqueName(v.filename) }));

    const results = await Promise.allSettled(tasks.map(async ({ url, filename }) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!res.body) throw new Error("Response body is empty");

        let fileHandle: FileSystemFileHandle | undefined;
        try {
            fileHandle = await dir.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            try {
                await res.body.pipeTo(writable);
            } catch (e) {
                await writable.abort();
                throw e;
            }
        } catch (e) {
            if (fileHandle) {
                try { await dir.removeEntry(filename); } catch { }
            }
            throw e;
        }
    }));

    const failed = results.filter(r => r.status === "rejected").length;
    const succeeded = media.length - failed;

    if (failed === 0) {
        showToast(`Successfully downloaded ${succeeded} media item(s).`, Toasts.Type.SUCCESS);
    } else {
        showToast(`Downloaded ${succeeded} of ${media.length} media item(s). ${failed} failed.`, Toasts.Type.FAILURE);
    }
}

const MessageContextMenuPatch = (children: any[], props: MessageContextProps) => {
    const { message, channel } = props;
    if (!message || !channel) return;

    const media = getMediaFromMessage(message);
    if (!media.length) return;

    children.push(
        <Menu.MenuGroup key="save-videos-msg-group">
            <Menu.MenuItem
                id="save-videos-download-message-media"
                label="Download Message Media"
                action={() => {
                    void downloadMedia(media);
                }}
            />
            <Menu.MenuItem
                id="save-videos-download-user-channel-media"
                label="Download User's Media in Channel"
                action={() => {
                    const msgCache = MessageStore.getMessages(channel.id);
                    const allMessages = msgCache && typeof msgCache.toArray === "function" ? msgCache.toArray() : [];
                    const userMessages = allMessages.filter((m: any) => m.author && m.author.id === message.author.id);
                    const allUserMedia = userMessages.flatMap((m: any) => getMediaFromMessage(m));
                    if (!allUserMedia.length) {
                        showToast("No media found from this user in this channel.", Toasts.Type.FAILURE);
                        return;
                    }
                    void downloadMedia(allUserMedia);
                }}
            />
        </Menu.MenuGroup>
    );
};

export default definePlugin({
    name: "SaveVideos",
    description: "Download all media from a message popover, or download all user's media in a channel via context menu.",
    authors: [{ name: "ghostcord", id: 0n }],
    dependencies: ["MessagePopoverAPI"],
    enabledByDefault: true,

    contextMenus: {
        "message": MessageContextMenuPatch,
        "message-actions": MessageContextMenuPatch
    },

    messagePopoverButton: {
        icon: SaveIcon,
        render(message: Message) {
            const media = getMediaFromMessage(message);
            if (!media.length) return null;
            return {
                label: "Download Message Media",
                icon: SaveIcon,
                message,
                channel: ChannelStore.getChannel(message.channel_id),
                onClick: () => downloadMedia(media)
            };
        }
    }
});
