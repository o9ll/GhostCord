import { React } from "@webpack/common";
const { useState, useRef, useEffect } = React;
import type { UIEvent } from "react";

import { t, LANGUAGES, LANGUAGE_FLAGS, Language } from "@api/i18n";
import { useSettings, SettingsStore } from "@api/Settings";
import { plugins, startPlugin, stopPlugin } from "@api/PluginManager";
import { SearchableSelect } from "@webpack/common";
import { FormSwitch } from "@components/FormSwitch";
import { openModal, ModalRoot, ModalHeader, ModalContent, ModalFooter, ModalSize } from "@utils/modal";
import { localStorage } from "@utils/localStorage";
import { authorizeCloud, deauthorizeCloud } from "@api/SettingsSync/cloudSetup";
import { importSettings } from "@api/SettingsSync/offline";
import { showToast } from "@webpack/common";
// VencordNative is exposed as a global by the preload script, see globals.d.ts.

import { Button } from "./Button";
import { Flex } from "./Flex";
import { Heading } from "./Heading";
import { Paragraph } from "./Paragraph";
import { Link } from "./Link";

export const MELLOWTEL_ONBOARDING_VERSION = "1";
const STORAGE_KEY = "ghostcord_mellowtel_onboarding_seen_v" + MELLOWTEL_ONBOARDING_VERSION;

const FLAG_ICON_STYLE: React.CSSProperties = { width: 20, height: 15, borderRadius: 2, verticalAlign: "middle", objectFit: "cover" };

const PRESET_OPTIONS = ["none", "default", "safe"] as const;
type PresetOption = typeof PRESET_OPTIONS[number];

const SAFE_PLUGINS: string[] = [
    "MessageCleaner", "BigFileUpload", "FakeVoice", 
    "GhostcordUpdater", "CrashHandler", "ImageZoom",  
    "ShowHiddenChannels", "ShowID", "VoiceMessages", "CallTimer", "DisableCallIdle", 
    "FastPFP", "FollowUser", "IconViewer", "PinDMs", 
    "ReverseImageSearch", "Translate", "UnlimitedAccounts", "UserVoiceShow", 
    "ValidUser", "ViewIcons", "WhosWatching", 
    "MessageLogger", "MessageLoggerEnhanced", "RealtimeTimestamps", "SpotifyCrack", "CancelFriendRequest",
    "VolumeBooster", "SaveVideos"
];

export function shouldShowMellowtelOnboarding(): boolean {
    return !SettingsStore.store.mellowtelOnboardingSeen;
}

function persistChoice(accepted: boolean) {
    SettingsStore.store.mellowtelOnboardingSeen = true;
    SettingsStore.markAsChanged();
    try {
        VencordNative.mellowtel?.setConsent?.(accepted, MELLOWTEL_ONBOARDING_VERSION);
    } catch (e) {
        // Ignore
    }
}

function MellowtelOnboardingContent({ onClose }: { onClose: () => void }) {
    const [step, setStep] = useState(1);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [preset, setPreset] = useState<PresetOption>("safe");
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    function processFile(file: File) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result;
            if (typeof text === "string") {
                try {
                    await importSettings(text, "all", false);
                    showToast("Config imported successfully! Restarting...", { type: "success" });
                    setTimeout(() => location.reload(), 1500);
                } catch (err) {
                    showToast("Failed to import config.", { type: "error" });
                }
            }
        };
        reader.readAsText(file);
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }

    const settings = useSettings(["language", "cloud", "syncOwnCustomProfile"]);

    useEffect(() => {
        // Force sync OFF by default when the modal is first opened
        if (settings.cloud && settings.cloud.settingsSync !== false) {
            settings.cloud.settingsSync = false;
        }
        if (settings.syncOwnCustomProfile !== false) {
            settings.syncOwnCustomProfile = false;
        }
    }, []);

    const handleScroll = (e: UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 15) {
            setHasScrolledToBottom(true);
        }
    };

    const applyPreset = async () => {
        // Disable all plugins natively first
        let i = 0;
        for (const [key, plugin] of Object.entries(plugins)) {
            stopPlugin(plugin);
            if (!SettingsStore.store.plugins[key]) {
                SettingsStore.store.plugins[key] = { enabled: false };
            } else {
                SettingsStore.store.plugins[key].enabled = false;
            }
            if (++i % 10 === 0) await new Promise(r => setTimeout(r, 0));
        }

        if (preset === "default") {
            for (const [key, plugin] of Object.entries(plugins)) {
                if (plugin.enabledByDefault || plugin.required) {
                    startPlugin(plugin);
                    if (!SettingsStore.store.plugins[key]) SettingsStore.store.plugins[key] = { enabled: true };
                    else SettingsStore.store.plugins[key].enabled = true;
                }
                if (++i % 10 === 0) await new Promise(r => setTimeout(r, 0));
            }
        } else if (preset === "safe") {
            for (const key of SAFE_PLUGINS) {
                if (plugins[key]) {
                    startPlugin(plugins[key]);
                    if (!SettingsStore.store.plugins[key]) SettingsStore.store.plugins[key] = { enabled: true };
                    else SettingsStore.store.plugins[key].enabled = true;
                }
                if (++i % 10 === 0) await new Promise(r => setTimeout(r, 0));
            }
        }
        SettingsStore.markAsChanged();
    };

    const renderProgressBar = () => {
        return (
            <Flex style={{ gap: "8px", marginBottom: "20px", marginTop: "12px", width: "100%" }}>
                {[1, 2, 3, 4].map(i => (
                    <div 
                        key={i}
                        style={{
                            flex: 1,
                            height: "4px",
                            backgroundColor: i <= step ? "#5865F2" : "rgba(255, 255, 255, 0.1)",
                            borderRadius: "2px",
                            transition: "background-color 0.3s ease"
                        }}
                    />
                ))}
            </Flex>
        );
    };

    if (step === 4) {
        return (
            <>
                <ModalHeader separator={false} style={{ paddingBottom: "0" }}>
                    <Flex direction="vertical" style={{ width: "100%" }}>
                        <Heading tag="h2" id="mellowtel-onboarding-title" style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff" }}>
                            {t("Configuration Presets")}
                        </Heading>
                        {renderProgressBar()}
                    </Flex>
                </ModalHeader>

                <ModalContent style={{ padding: "24px 20px" }}>
                    <div style={{ textAlign: "center", marginBottom: "32px" }}>
                        <div style={{ display: "inline-flex", padding: "12px", borderRadius: "50%", backgroundColor: "rgba(88, 101, 242, 0.1)", color: "#5865F2", marginBottom: "16px" }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                            </svg>
                        </div>
                        <Heading tag="h3" style={{ fontSize: "24px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>
                            {t("Select Your Experience")}
                        </Heading>
                        <Paragraph style={{ color: "#b5bac1", fontSize: "15px", lineHeight: "1.6", maxWidth: "400px", margin: "0 auto" }}>
                            {t("Choose a plugin preset to start with. You can completely customize your plugins later in the settings.")}
                        </Paragraph>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginTop: "16px" }}>
                        {[
                            { id: "none", title: "None", desc: "Start fresh. Zero plugins enabled." },
                            { id: "default", title: "Default", desc: "The standard Ghostcord experience with recommended plugins." },
                            { id: "safe", title: "Current", desc: "Essential Plugins Only. Keep your current safe and minimal active configuration." }
                        ].map(p => (
                            <div 
                                key={p.id}
                                onClick={() => setPreset(p.id as PresetOption)}
                                style={{
                                    padding: "20px 16px",
                                    backgroundColor: "rgba(30, 31, 34, 0.4)",
                                    border: `2px solid ${preset === p.id ? "#5865f2" : "rgba(255,255,255,0.05)"}`,
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    textAlign: "center",
                                    boxSizing: "border-box"
                                }}
                            >
                                <div style={{ 
                                    width: "48px", height: "48px", borderRadius: "24px", 
                                    backgroundColor: preset === p.id ? "#5865f2" : "rgba(255,255,255,0.05)",
                                    color: preset === p.id ? "#ffffff" : "#80848e", 
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    marginBottom: "16px", transition: "all 0.2s ease"
                                }}>
                                    {p.id === "none" && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                                    {p.id === "default" && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
                                    {p.id === "safe" && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
                                </div>
                                <div style={{ color: preset === p.id ? "#ffffff" : "#b5bac1", fontWeight: 600, fontSize: "16px", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    {t(p.title)}
                                </div>
                                <div style={{ color: preset === p.id ? "rgba(255,255,255,0.9)" : "#80848e", fontSize: "13px", lineHeight: "1.5" }}>
                                    {t(p.desc)}
                                </div>
                            </div>
                        ))}
                    </div>

                    <style>{`
                        .nc-config-dropzone.nc-drag-over::after {
                            content: '';
                            position: absolute;
                            inset: 0;
                            border-radius: 12px;
                            background: linear-gradient(135deg, rgba(88, 101, 242, 0.15), rgba(167, 139, 250, 0.08));
                            animation: nc-config-pulse 1.5s ease-in-out infinite;
                            pointer-events: none;
                        }
                        @keyframes nc-config-pulse {
                            0%, 100% { opacity: 0.6; }
                            50%       { opacity: 1; }
                        }
                        .nc-config-dropzone-icon {
                            transition: transform 0.2s;
                        }
                        .nc-config-dropzone:hover .nc-config-dropzone-icon,
                        .nc-config-dropzone.nc-drag-over .nc-config-dropzone-icon {
                            transform: translateY(-3px) scale(1.1);
                        }
                    `}</style>

                    <div
                        className={`nc-config-dropzone${dragging ? " nc-drag-over" : ""}`}
                        onDragOver={e => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => inputRef.current?.click()}
                        style={{
                            position: "relative",
                            marginTop: "24px",
                            border: `2px dashed ${dragging ? "#5865f2" : "rgba(88, 101, 242, 0.4)"}`,
                            borderRadius: "12px",
                            padding: "28px 20px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            cursor: "pointer",
                            transition: "border-color 0.2s, background 0.2s",
                            background: dragging ? "rgba(88, 101, 242, 0.1)" : "rgba(88, 101, 242, 0.04)",
                            textAlign: "center",
                            minHeight: "130px",
                            overflow: "hidden"
                        }}
                    >
                        <input
                            type="file"
                            accept=".json"
                            style={{ display: "none" }}
                            ref={inputRef}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) processFile(file);
                            }}
                        />
                        <div className="nc-config-dropzone-icon" style={{ color: "#5865f2", opacity: 0.8 }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ transition: "all 0.2s ease" }}>
                                <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M3 15l4-4.5 3.5 4L14 9l7 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
                                <circle cx="18" cy="6" r="5" fill="var(--background-primary, #313338)" />
                                <path d="M18 3.5v5M15.5 6h5" stroke="#5865f2" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                        </div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff", lineHeight: 1.4 }}>
                            {dragging ? t("Release to import!") : t("Import Backup JSON")}
                        </div>
                        <div style={{ fontSize: "11px", color: "#949ba4", lineHeight: 1.4 }}>
                            {t("Drag & drop your config file here, or click to browse")}
                        </div>
                    </div>
                </ModalContent>

                <ModalFooter>
                    <Flex style={{ width: "100%", justifyContent: "space-between", alignItems: "center" }}>
                        <Link onClick={() => { persistChoice(true); onClose(); }} style={{ fontSize: "13px", color: "var(--text-muted)", cursor: "pointer" }}>
                            {t("Skip")}
                        </Link>
                        <Button
                            variant="primary"
                            onClick={async () => {
                                await applyPreset();
                                persistChoice(true);
                                onClose();
                            }}
                            style={{ padding: "10px 24px", fontWeight: "bold" }}
                        >
                            {t("Finish Setup")}
                        </Button>
                    </Flex>
                </ModalFooter>
            </>
        );
    }

    if (step === 3) {
        return (
            <>
                <ModalHeader separator={false} style={{ paddingBottom: "0" }}>
                    <Flex direction="vertical" style={{ width: "100%" }}>
                        <Heading tag="h2" id="mellowtel-onboarding-title" style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff" }}>
                            {t("Sync System")}
                        </Heading>
                        {renderProgressBar()}
                    </Flex>
                </ModalHeader>

                <ModalContent style={{ padding: "16px 20px" }}>
                    <Paragraph style={{ color: "#dbdee1", fontSize: "14px", lineHeight: "1.5", marginBottom: "24px" }}>
                        {t("Synchronize your Ghostcord settings, plugins, and custom profiles across all your devices securely through the cloud. This requires Discord authorization. Once enabled, everyone using Ghostcord will be able to see your Custom Profile, and you will be able to see theirs. You can also easily backup your configurations and automatically restore them on another device.")}
                    </Paragraph>

                    <div style={{ marginTop: "8px" }}>
                        <FormSwitch
                            value={settings.cloud?.settingsSync || false}
                            onChange={async (v) => {
                                if (v) {
                                    try {
                                        await deauthorizeCloud();
                                        await authorizeCloud();
                                    } catch (e) {
                                        return;
                                    }
                                } else {
                                    try {
                                        await deauthorizeCloud();
                                    } catch (e) {
                                        // Ignore
                                    }
                                }
                                if (settings.cloud) settings.cloud.settingsSync = v;
                                settings.syncOwnCustomProfile = v;
                            }}
                            title={t("Enable Sync System")}
                            note={t("Requires Discord OAuth2 authorization to securely link your account with our cloud service.")}
                        />
                    </div>
                </ModalContent>

                <ModalFooter>
                    <Flex style={{ width: "100%", justifyContent: "space-between", alignItems: "center" }}>
                        <Link onClick={() => setStep(4)} style={{ fontSize: "13px", color: "#949ba4", cursor: "pointer" }}>
                            {t("Skip")}
                        </Link>
                        <Button
                            variant="primary"
                            onClick={() => setStep(4)}
                            style={{ padding: "10px 24px", fontWeight: "bold" }}
                        >
                            {t("Next")}
                        </Button>
                    </Flex>
                </ModalFooter>
            </>
        );
    }

    if (step === 2) {
        const current = (settings.language as Language) ?? "en";

        return (
            <>
                <ModalHeader separator={false} style={{ paddingBottom: "0" }}>
                    <Flex direction="vertical" style={{ width: "100%" }}>
                        <Heading tag="h2" id="mellowtel-onboarding-title" style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff" }}>
                            {t("Language Selection")}
                        </Heading>
                        {renderProgressBar()}
                    </Flex>
                </ModalHeader>

                <ModalContent style={{ padding: "16px 20px" }}>
                    <Paragraph style={{ color: "#dbdee1", fontSize: "14px", lineHeight: "1.5", marginBottom: "24px" }}>
                        {t("Choose your preferred language for Ghostcord UI. This setting will immediately apply to all menus and settings within Ghostcord.")}
                    </Paragraph>
                    
                    <div style={{ marginTop: "16px" }}>
                        <SearchableSelect
                            options={Object.entries(LANGUAGES).map(([key, name]) => ({
                                label: name,
                                value: key
                            }))}
                            value={current}
                            onChange={lang => {
                                settings.language = lang;
                            }}
                            renderOptionLabel={opt => {
                                return (
                                    <div style={{ display: "flex", alignItems: "center" }}>
                                        <span style={{ fontWeight: 500 }}>{opt.label}</span>
                                    </div>
                                );
                            }}
                            renderOptionPrefix={opt => {
                                const flag = LANGUAGE_FLAGS[opt?.value as Language];
                                return flag ? <img src={flag} style={FLAG_ICON_STYLE} alt="" /> : null;
                            }}
                        />
                    </div>
                </ModalContent>

                <ModalFooter>
                    <Flex style={{ width: "100%", justifyContent: "space-between", alignItems: "center" }}>
                        <Link onClick={() => setStep(3)} style={{ fontSize: "13px", color: "#949ba4", cursor: "pointer" }}>
                            {t("Skip")}
                        </Link>
                        <Button
                            variant="primary"
                            onClick={() => setStep(3)}
                            style={{ padding: "10px 24px", fontWeight: "bold" }}
                        >
                            {t("Next")}
                        </Button>
                    </Flex>
                </ModalFooter>
            </>
        );
    }

    return (
        <>
            <style>{`
                .mellowtel-terms-scroller::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                .mellowtel-terms-scroller::-webkit-scrollbar-track {
                    background-color: var(--scrollbar-thin-track, transparent);
                    border-radius: 4px;
                }
                .mellowtel-terms-scroller::-webkit-scrollbar-thumb {
                    background-color: var(--scrollbar-thin-thumb, rgba(255, 255, 255, 0.2));
                    border-radius: 4px;
                }
                .mellowtel-terms-scroller::-webkit-scrollbar-corner {
                    background-color: transparent;
                }
            `}</style>

            <ModalHeader separator={false} style={{ paddingBottom: "0" }}>
                <Flex direction="vertical" style={{ width: "100%" }}>
                    <Heading tag="h2" id="mellowtel-onboarding-title" style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff" }}>
                        {t("Terms of Service & Project Support")}
                    </Heading>
                    {renderProgressBar()}
                </Flex>
            </ModalHeader>

            <ModalContent style={{ padding: "16px 20px" }}>
                <Paragraph style={{ color: "#dbdee1", fontSize: "14px", lineHeight: "1.5" }}>
                    {t(
                        "Ghostcord is free and will stay that way. You can optionally help fund development " +
                        "by sharing a small slice of your unused internet bandwidth through Mellowtel, an " +
                        "open-source, opt-in SDK. Trusted partners use it to fetch publicly available web data, " +
                        "and Ghostcord gets a share of the revenue. Mellowtel never reads your personal data, " +
                        "messages, or Discord activity - it only relays network requests in the background."
                     )}
                </Paragraph>
                
                <Paragraph style={{ marginTop: "12px", color: "#949ba4", fontSize: "13px" }}>
                    {t("You can change this choice at any time from Ghostcord's settings.")}
                </Paragraph>

                {!showAdvanced && (
                    <div style={{ marginTop: "20px", textAlign: "right" }}>
                        <Link 
                            onClick={() => setShowAdvanced(true)} 
                            style={{ cursor: "pointer", fontSize: "12px", color: "#00a8fc", textDecoration: "none", opacity: 0.9 }}
                        >
                            {t("Show advanced settings / Opt-out")}
                        </Link>
                    </div>
                )}

                {showAdvanced && (
                    <div style={{ marginTop: "20px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "16px" }}>
                        <Paragraph style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px", color: "#dbdee1" }}>
                            {t("You must read the following agreement to the end to manage your choices:")}
                        </Paragraph>
                        
                        <div 
                            ref={scrollRef}
                            onScroll={handleScroll}
                            className="mellowtel-terms-scroller"
                            style={{ 
                                height: "130px", 
                                overflowY: "auto",
                                border: "1px solid rgba(255, 255, 255, 0.08)", 
                                borderRadius: "4px",
                                backgroundColor: "rgba(0, 0, 0, 0.24)",
                                padding: "10px",
                            }}
                        >
                            <div style={{ paddingRight: "8px", fontSize: "11px", color: "#949ba4", lineHeight: "1.5" }}>
                                <p style={{ marginBottom: "8px", color: "#dbdee1" }}><b>1. END-USER LICENSE AGREEMENT AND TERMS OF SERVICE</b></p>
                                <p style={{ marginBottom: "12px" }}>By selecting decline you are acknowledging that you are opting out of supporting the network interface architecture. Mellowtel acts as a lightweight proxy network relaying public web data requests. As an infrastructure partner, Ghostcord depends on this monetization model to continue hosting APIs, gateways, and maintaining fast file distribution networks completely free of charge.</p>
                                <p style={{ marginBottom: "8px", color: "#dbdee1" }}><b>2. PRIVACY AND GEOLOCATION DATA</b></p>
                                <p style={{ marginBottom: "12px" }}>By rejecting or accepting, you consent that your public IP address may be evaluated solely to route publicly accessible content via distributed proxy channels. Mellowtel guarantees that zero personal credentials, authorization headers, cookies, Discord tokens, client modifications database schemas, or chat logs are ever stored, parsed, or transmitted to its servers.</p>
                                <p style={{ marginBottom: "8px", color: "#dbdee1" }}><b>3. SYSTEM RESOURCE ALLOCATION LIMITATIONS</b></p>
                                <p style={{ marginBottom: "12px" }}>The background helper runs asynchronously on your local machine. It uses minimal system CPU resources and strictly throttles its bandwidth impact. Users selecting to bypass this service understand that future development builds of our project may become unsustainable under current high infrastructure running costs.</p>
                                <p style={{ marginBottom: "8px", color: "#dbdee1" }}><b>4. ACKNOWLEDGEMENT</b></p>
                                <p style={{ marginBottom: "4px" }}>I have fully read, understood, and processed the terms regarding decentralized routing network nodes, bandwidth optimization schemes, and community software financial maintenance requirements.</p>
                            </div>
                        </div>

                        {!hasScrolledToBottom && (
                            <p style={{ fontSize: "11px", color: "#f23f43", marginTop: "8px", textAlign: "right", fontWeight: 500 }}>
                                * Please scroll to the bottom of the terms to unlock all choices.
                            </p>
                        )}
                    </div>
                )}
            </ModalContent>

            <ModalFooter>
                <Flex style={{ width: "100%", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        {showAdvanced && hasScrolledToBottom ? (
                            <Button
                                variant="secondary"
                                size="small"
                                onClick={() => {
                                    persistChoice(false);
                                    setStep(2);
                                }}
                            >
                                {t("Decline support & continue")}
                            </Button>
                        ) : null}
                    </div>

                    <Button
                        variant="primary"
                        onClick={() => {
                            persistChoice(true);
                            setStep(2);
                        }}
                        style={{ padding: "10px 24px", fontWeight: "bold" }}
                    >
                        {t("Accept & Support Project")}
                    </Button>
                </Flex>
            </ModalFooter>
        </>
    );
}

export function openMellowtelOnboardingModal() {
    openModal(props => (
        <ModalRoot
            {...props}
            size={ModalSize.MEDIUM}
            role="alertdialog"
            aria-labelledby="mellowtel-onboarding-title"
        >
            <MellowtelOnboardingContent onClose={props.onClose} />
        </ModalRoot>
    ), {
        onCloseRequest: () => { }
    });
}