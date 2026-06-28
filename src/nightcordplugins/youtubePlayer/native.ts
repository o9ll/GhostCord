import { BrowserWindow, IpcMainInvokeEvent, net } from "electron";

async function netGet(url: string): Promise<string> {
    const resp = await net.fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.text();
}

export async function installWatchingTogetherIntercept(_: IpcMainInvokeEvent) {
    const { session } = require("electron");
    try {
        const adPatterns = [
            "*://*.doubleclick.net/*",
            "*://*.googlevideo.com/*oad=*",
            "*://*.googlevideo.com/*adformat=*",
            "*://*.youtube.com/pagead/*",
            "*://*.youtube.com/api/stats/ads*",
            "*://*.youtube.com/ptracking*",
            "*://*.youtube-nocookie.com/pagead/*",
            "*://*.youtube-nocookie.com/api/stats/ads*",
        ];
        session.defaultSession.webRequest.onBeforeRequest({ urls: adPatterns }, (_d: any, cb: any) => cb({ cancel: true }));
        
        session.defaultSession.webRequest.onBeforeSendHeaders({
            urls: [
                "*://*.youtube.com/youtubei/v1/player*",
                "*://*.youtube-nocookie.com/youtubei/v1/player*"
            ]
        }, (details: any, cb: any) => {
            const headers = { ...details.requestHeaders };
            headers["Referer"] = "https://www.youtube.com/";
            headers["Origin"] = "https://www.youtube.com";
            cb({ requestHeaders: headers });
        });
    } catch (e) { console.error("YTD adblocker error:", e); }

    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
        win.webContents.setWindowOpenHandler((details) => {
            if (details.url.startsWith("https://nightcord.st/watch?")) {
                try {
                    const url = new URL(details.url);
                    const ytId = url.searchParams.get("v") ?? "";
                    BrowserWindow.getAllWindows().forEach(w => {
                        try {
                            w.webContents.executeJavaScript(
                                `window.dispatchEvent(new CustomEvent('youtube-watch-together', { detail: { ytId: ${JSON.stringify(ytId)} } }))`
                            ).catch(() => {});
                        } catch { }
                    });
                } catch { }
                return { action: "deny" };
            }
            return { action: "allow" };
        });
    }
}

export async function searchYouTube(_: IpcMainInvokeEvent, query: string): Promise<string> {
    if (!query?.trim()) return JSON.stringify({ videos: [], channels: [] });
    const html = await netGet(`https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`);

    const startIdx = html.indexOf("var ytInitialData = ");
    if (startIdx === -1) throw new Error("Could not find ytInitialData");
    const jsonStart = startIdx + "var ytInitialData = ".length;
    const scriptEnd = html.indexOf("</script>", jsonStart);
    const rawStr = scriptEnd > -1 ? html.slice(jsonStart, scriptEnd).replace(/;\s*$/, "") : html.slice(jsonStart, jsonStart + 800000);
    const json = JSON.parse(rawStr);
    const contents =
        json.contents
            ?.twoColumnSearchResultsRenderer
            ?.primaryContents
            ?.sectionListRenderer
            ?.contents?.[0]
            ?.itemSectionRenderer
            ?.contents ?? [];

    const channels = contents
        .filter((c: any) => c.channelRenderer)
        .slice(0, 4)
        .map((c: any) => {
            const ch = c.channelRenderer;
            const thumbs: any[] = ch.thumbnail?.thumbnails ?? [];
            const thumb = thumbs[thumbs.length - 1]?.url?.replace(/^\/\//, "https://") ?? "";
            const subs = ch.subscriberCountText?.simpleText ?? ch.videoCountText?.runs?.map((r:any) => r.text).join("") ?? "";
            return {
                channelId: ch.channelId ?? "",
                title: ch.title?.simpleText ?? "Unknown Channel",
                handle: ch.subscriberCountText?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ?? ch.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ?? ch.customUrl ?? "",
                subscriberCount: subs,
                artworkUrl: thumb,
                isChannel: true,
            };
        });

    const videos = contents
        .filter((c: any) => c.videoRenderer)
        .slice(0, 24)
        .map((c: any) => {
            const v = c.videoRenderer;
            const thumbs: any[] = v.thumbnail?.thumbnails ?? [];
            const thumb = thumbs[thumbs.length - 1]?.url ?? thumbs[0]?.url ?? "";
            const viewCount = v.shortViewCountText?.simpleText
                ?? v.shortViewCountText?.runs?.map((r: any) => r.text).join("")
                ?? v.viewCountText?.simpleText
                ?? "";
            return {
                id: v.videoId ?? "",
                title: v.title?.runs?.[0]?.text ?? "Unknown Title",
                author: v.ownerText?.runs?.[0]?.text ?? "Unknown Author",
                artworkUrl: thumb,
                durationStr: v.lengthText?.simpleText ?? "Live",
                viewCount,
            };
        });

    return JSON.stringify({ videos, channels });
}

export async function resolveVideoDetails(_: IpcMainInvokeEvent, videoId: string): Promise<string> {
    if (!videoId) throw new Error("No video ID");
    const html = await netGet(`https://www.youtube.com/watch?v=${videoId}`);
    const match = html.match(/var ytInitialPlayerResponse = (\{.*?\});<\/script>/);
    if (!match) throw new Error("Could not find ytInitialPlayerResponse");
    const json = JSON.parse(match[1]);
    const d = json.videoDetails;
    if (!d) throw new Error("No videoDetails");
    const thumbs: any[] = d.thumbnail?.thumbnails ?? [];
    const thumb = thumbs[thumbs.length - 1]?.url ?? "";
    const secs = Number(d.lengthSeconds ?? 0);
    return JSON.stringify({
        id: d.videoId, title: d.title, author: d.author, artworkUrl: thumb,
        durationStr: secs > 0 ? `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}` : "Live",
        viewCount: "",
    });
}

export async function searchChannelVideos(_: IpcMainInvokeEvent, handleOrId: string): Promise<string> {
    let url = `https://www.youtube.com/channel/${handleOrId}/videos`;
    if (handleOrId.startsWith("@") || handleOrId.startsWith("/")) {
        const h = handleOrId.startsWith("/") ? handleOrId : `/${handleOrId}`;
        url = `https://www.youtube.com${h}/videos`;
    }
    const html = await netGet(url);
    // YouTube embeds ytInitialData as a JS variable; extract the JSON.
    // We use a two-step extraction: find the start marker, then parse manually.
    let json: any = null;
    try {
        const startIdx = html.indexOf("var ytInitialData = ");
        if (startIdx === -1) return JSON.stringify({ videos: [], channels: [], channelInfo: null });
        const jsonStart = startIdx + "var ytInitialData = ".length;
        // Find the closing </script> to bound our search
        const scriptEnd = html.indexOf("</script>", jsonStart);
        const rawStr = scriptEnd > -1 ? html.slice(jsonStart, scriptEnd).replace(/;\s*$/, "") : html.slice(jsonStart, jsonStart + 500000);
        json = JSON.parse(rawStr);
    } catch {
        return JSON.stringify({ videos: [], channels: [], channelInfo: null });
    }
    try {
        let channelInfo = null;
        if (json.header?.pageHeaderRenderer) {
            const h = json.header.pageHeaderRenderer.content?.pageHeaderViewModel;
            const banner = h?.banner?.imageBannerViewModel?.image?.sources;
            const avatar = h?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources;
            
            channelInfo = {
                title: h?.title?.dynamicTextViewModel?.text?.content,
                bio: h?.description?.descriptionPreviewViewModel?.description?.content,
                bannerUrl: banner ? banner[banner.length - 1].url : null,
                avatarUrl: avatar ? avatar[avatar.length - 1].url : null,
                subscribers: h?.metadata?.contentMetadataViewModel?.metadataRows?.[1]?.metadataParts?.[0]?.text?.content,
                videoCount: h?.metadata?.contentMetadataViewModel?.metadataRows?.[1]?.metadataParts?.[1]?.text?.content
            };
        } else if (json.header?.c4TabbedHeaderRenderer) {
            const h = json.header.c4TabbedHeaderRenderer;
            const banner = h.banner?.thumbnails;
            const avatar = h.avatar?.thumbnails;
            
            channelInfo = {
                title: h.title,
                bio: json.metadata?.channelMetadataRenderer?.description,
                bannerUrl: banner ? banner[banner.length - 1].url : null,
                avatarUrl: avatar ? avatar[avatar.length - 1].url : null,
                subscribers: h.subscriberCountText?.simpleText,
                videoCount: null
            };
        }

        const tabs = json.contents?.twoColumnBrowseResultsRenderer?.tabs ?? [];
        let videos: any[] = [];
        for (const tab of tabs) {
            const items = tab.tabRenderer?.content?.richGridRenderer?.contents ?? [];
            let vids = items
                .filter((i: any) => i.richItemRenderer?.content)
                .map((i: any) => {
                    const content = i.richItemRenderer.content;

                    // New YouTube structure (lockupViewModel)
                    if (content.lockupViewModel) {
                        const lvm = content.lockupViewModel;
                        const thumbs: any[] = lvm.contentImage?.thumbnailViewModel?.image?.sources ?? [];
                        const thumb = thumbs[thumbs.length - 1]?.url ?? thumbs[0]?.url ?? "";
                        const overlays: any[] = lvm.contentImage?.thumbnailViewModel?.overlays ?? [];
                        let durationStr = "Live";
                        for (const o of overlays) {
                            const text = o.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text;
                            if (text) { durationStr = text; break; }
                        }
                        const metaRows = lvm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows ?? [];
                        const viewCount = metaRows[0]?.metadataParts?.[0]?.text?.content ?? "";
                        return {
                            id: lvm.contentId ?? "",
                            title: lvm.metadata?.lockupMetadataViewModel?.title?.content ?? "Unknown",
                            author: "",
                            artworkUrl: thumb,
                            durationStr,
                            viewCount,
                        };
                    }

                    // Legacy structure (videoRenderer)
                    if (content.videoRenderer) {
                        const v = content.videoRenderer;
                        const thumbs: any[] = v.thumbnail?.thumbnails ?? [];
                        const thumb = thumbs[thumbs.length - 1]?.url ?? thumbs[0]?.url ?? "";
                        const viewCount = v.shortViewCountText?.simpleText ?? v.shortViewCountText?.runs?.map((r: any) => r.text).join("") ?? "";
                        return { id: v.videoId ?? "", title: v.title?.runs?.[0]?.text ?? "Unknown", author: v.ownerText?.runs?.[0]?.text ?? "", artworkUrl: thumb, durationStr: v.lengthText?.simpleText ?? "Live", viewCount };
                    }

                    return null;
                })
                .filter(Boolean);
            
            // Fallback: sectionListRenderer (older channel pages)
            if (vids.length === 0) {
                const sections = tab.tabRenderer?.content?.sectionListRenderer?.contents ?? [];
                for (const sec of sections) {
                    const shelf = sec.itemSectionRenderer?.contents?.[0]?.shelfRenderer;
                    const rows = shelf?.content?.horizontalListRenderer?.items ?? shelf?.content?.expandedShelfContentsRenderer?.items ?? [];
                    vids = rows
                        .filter((i: any) => i.videoRenderer)
                        .map((i: any) => {
                            const v = i.videoRenderer;
                            const thumbs: any[] = v.thumbnail?.thumbnails ?? [];
                            const thumb = thumbs[thumbs.length - 1]?.url ?? "";
                            const viewCount = v.shortViewCountText?.simpleText ?? "";
                            return { id: v.videoId ?? "", title: v.title?.runs?.[0]?.text ?? "Unknown", author: v.ownerText?.runs?.[0]?.text ?? "", artworkUrl: thumb, durationStr: v.lengthText?.simpleText ?? "Live", viewCount };
                        });
                    if (vids.length > 0) break;
                }
            }
            
            if (vids.length > 0) { videos = vids.slice(0, 24); break; }
        }
        return JSON.stringify({ videos, channels: [], channelInfo });
    } catch { return JSON.stringify({ videos: [], channels: [], channelInfo: null }); }
}
