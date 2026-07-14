/*
 * Nightcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { HeaderBarButton } from "@api/HeaderBar";
import { ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin, { IconComponent, OptionType, PluginNative } from "@utils/types";
import { React } from "@webpack/common";

const Native = VencordNative.pluginHelpers.YoutubeInDiscord as PluginNative<any>;

// ── Settings ───────────────────────────────────────────────────────────────

const settings = definePluginSettings({
    destroyOnClose: {
        type: OptionType.BOOLEAN,
        description: "Destroy the YouTube tab when closing the window (zero RAM usage when closed, but reloads YouTube on each open)",
        default: false,
        restartNeeded: false,
    }
});

// ── Icons ──────────────────────────────────────────────────────────────────

function YoutubeIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill="none" viewBox="0 0 24 24" {...props}>
            <path fill="currentColor" d="M23.5 5.65a3.02 3.02 0 0 0-2.12-2.14C19.5 3 12 3 12 3s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 5.66C0 7.55 0 11.5 0 11.5s0 3.95.5 5.85a3.02 3.02 0 0 0 2.12 2.14C4.5 20 12 20 12 20s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.15c.5-1.9.5-5.85.5-5.85s0-3.95-.5-5.85ZM9.55 15.1V7.9l6.27 3.59-6.27 3.59Z" />
        </svg>
    );
}
const YoutubeIconComponent: IconComponent = props => <YoutubeIcon {...props} />;

function IconX() {
    return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12"/></svg>;
}

// ── Persistent global iframe ────────────────────────────────────────────────

let rafId: number | null = null;
let placeholderEl: HTMLDivElement | null = null;

function getOrCreateContainer(): HTMLDivElement {
    let el = document.getElementById("ytd-global-iframe-container") as HTMLDivElement | null;
    if (!el) {
        el = document.createElement("div");
        el.id = "ytd-global-iframe-container";
        // Start fully hidden — never visible until showContainer() is called
        el.style.display = "none";
        el.style.position = "fixed";
        el.style.left = "-9999px";
        el.style.top = "-9999px";
        el.style.width = "1px";
        el.style.height = "1px";
        el.style.zIndex = "10000002";
        el.style.background = "#0f0f0f";
        el.style.overflow = "hidden";

        const iframe = document.createElement("iframe");
        iframe.id = "ytd-global-iframe";
        iframe.src = "https://www.youtube.com";
        iframe.style.cssText = "width:100%;height:100%;border:none;display:block;";
        iframe.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write; clipboard-read";
        iframe.setAttribute("allowfullscreen", "true");

        el.appendChild(iframe);
        document.body.appendChild(el);
    }
    return el;
}

function showContainer() {
    const container = getOrCreateContainer();

    // Sync position before revealing — no positional flash
    syncPosition(container);
    container.style.display = "block";

    // RAF loop keeps iframe glued to the placeholder while modal is open
    function loop() {
        syncPosition(container);
        rafId = requestAnimationFrame(loop);
    }
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
}

function syncPosition(container: HTMLDivElement) {
    if (!placeholderEl) return;
    const r = placeholderEl.getBoundingClientRect();
    container.style.left   = `${Math.round(r.left)}px`;
    container.style.top    = `${Math.round(r.top)}px`;
    container.style.width  = `${Math.round(r.width)}px`;
    container.style.height = `${Math.round(r.height)}px`;
}

function hideOrDestroyContainer() {
    // Stop RAF loop
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    placeholderEl = null;

    const container = document.getElementById("ytd-global-iframe-container") as HTMLDivElement | null;
    if (!container) return;

    if (settings.store.destroyOnClose) {
        // Zero consumption mode: fully remove the iframe from the DOM
        container.remove();
    } else {
        // Persistent mode: just hide it (keeps audio/video alive)
        container.style.display = "none";
    }
}

function destroyContainer() {
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    placeholderEl = null;
    const container = document.getElementById("ytd-global-iframe-container");
    if (container) container.remove();
}

// ── Modal ──────────────────────────────────────────────────────────────────

function YoutubeModal({ onClose }: { onClose: () => void }) {
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        placeholderEl = ref.current;
        showContainer();

        return () => {
            hideOrDestroyContainer();
        };
    }, []);

    return (
        <div className="ytd-player-root">
            <div className="ytd-header">
                <span className="ytd-header-title">
                    <YoutubeIcon style={{ color: "#ff0000" }} />
                    YouTube In Discord
                </span>
                <button className="ytd-close-btn" onClick={onClose}><IconX /></button>
            </div>
            <div ref={ref} style={{ flex: 1, width: "100%", minHeight: 0, background: "#0f0f0f" }} />
        </div>
    );
}

// ── Header button ──────────────────────────────────────────────────────────

function YTHeaderBarButton() {
    return (
        <HeaderBarButton
            icon={YoutubeIconComponent}
            tooltip="YouTube In Discord"
            onClick={() => openModal(props => (
                <ModalRoot {...props} size={ModalSize.DYNAMIC}>
                    <YoutubeModal onClose={props.onClose} />
                </ModalRoot>
            ))}
        />
    );
}

// ── Plugin ─────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "YoutubeInDiscord",
    enabledByDefault: true,
    description: "Watch real YouTube inside Discord, with videos, comments, and full functionality.",
    authors: [{ name: "Nightcord", id: 0n }],
    settings,

    headerBarButton: { icon: YoutubeIconComponent, render: YTHeaderBarButton },

    start() {
        Native.installWatchingTogetherIntercept().catch(() => {});
        // Lazy init: iframe is NOT created here.
        // It will be created on first open only.
    },

    stop() {
        destroyContainer();
    }
});
