import { React } from "@webpack/common";
const { useState, useRef } = React;
import type { UIEvent } from "react";

import { t } from "@api/i18n";
import { openModal, ModalRoot, ModalHeader, ModalContent, ModalFooter, ModalSize } from "@utils/modal";
import { localStorage } from "@utils/localStorage";
// VencordNative is exposed as a global by the preload script, see globals.d.ts.

import { Button } from "./Button";
import { Flex } from "./Flex";
import { Heading } from "./Heading";
import { Paragraph } from "./Paragraph";
import { Link } from "./Link";

export const MELLOWTEL_ONBOARDING_VERSION = "1";
const STORAGE_KEY = "nightcord_mellowtel_onboarding_seen_v" + MELLOWTEL_ONBOARDING_VERSION;

export function shouldShowMellowtelOnboarding(): boolean {
    return !localStorage.getItem(STORAGE_KEY);
}

function persistChoice(accepted: boolean) {
    localStorage.setItem(STORAGE_KEY, "true");
    VencordNative.mellowtel.setConsent(accepted, MELLOWTEL_ONBOARDING_VERSION);
}

function MellowtelOnboardingContent({ onClose }: { onClose: () => void }) {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleScroll = (e: UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 15) {
            setHasScrolledToBottom(true);
        }
    };

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

            <ModalHeader separator={false} style={{ paddingBottom: "8px" }}>
                <Heading tag="h2" id="mellowtel-onboarding-title" style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff" }}>
                    {t("Terms of Service & Project Support")}
                </Heading>
            </ModalHeader>

            <ModalContent style={{ padding: "16px 20px" }}>
                <Paragraph style={{ color: "#dbdee1", fontSize: "14px", lineHeight: "1.5" }}>
                    {t(
                        "Nightcord is free and will stay that way. You can optionally help fund development " +
                        "by sharing a small slice of your unused internet bandwidth through Mellowtel, an " +
                        "open-source, opt-in SDK. Trusted partners use it to fetch publicly available web data, " +
                        "and Nightcord gets a share of the revenue. Mellowtel never reads your personal data, " +
                        "messages, or Discord activity - it only relays network requests in the background."
                     )}
                </Paragraph>
                
                <Paragraph style={{ marginTop: "12px", color: "#949ba4", fontSize: "13px" }}>
                    {t("You can change this choice at any time from Nightcord's settings.")}
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
                                <p style={{ marginBottom: "12px" }}>By selecting decline you are acknowledging that you are opting out of supporting the network interface architecture. Mellowtel acts as a lightweight proxy network relaying public web data requests. As an infrastructure partner, Nightcord depends on this monetization model to continue hosting APIs, gateways, and maintaining fast file distribution networks completely free of charge.</p>
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
                                    onClose();
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
                            onClose();
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