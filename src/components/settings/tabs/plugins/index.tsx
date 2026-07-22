/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import "./styles.css";

import * as DataStore from "@api/DataStore";
import { isPluginEnabled, startPlugin, stopPlugin } from "@api/PluginManager";
import { Settings, useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Notice } from "@components/Notice";
import { Divider } from "@components/Divider";
import ErrorBoundary from "@components/ErrorBoundary";
import { HeadingTertiary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab } from "@components/settings";
import { debounce } from "@shared/debounce";
import { ChangeList } from "@utils/ChangeList";
import { classNameFactory } from "@utils/css";
import { isTruthy } from "@utils/guards";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { relaunch, showItemInFolder } from "@utils/native";
import { useAwaiter } from "@utils/react";
import { Alerts, lodash, Parser, React, SearchableSelect, Select as DiscordSelect, TextInput, Toasts, Tooltip, useCallback, useMemo, useState } from "@webpack/common";
import { JSX } from "react";
import { t } from "@api/i18n";

import Plugins, { ExcludedPlugins, PluginMeta } from "~plugins";
import { fetchPluginRatings, PluginRatings } from "@api/PluginLikes";
import { authorizeLikeSystem, LIKE_AUTH_EVENT } from "@api/PluginLikesAuth";
import { getStoredToken } from "@api/OAuth2";

import { PluginCard } from "./PluginCard";
import { openPluginModal, openResetDefaultsModal, openWarningModal } from "./PluginModal";
import { StockPluginsCard } from "./PluginStatCards";
import { TUTORIAL_PLUGIN_NAMES } from "./tutorialList";
import { UIElementsButton } from "./UIElements";

const GHOSTCORD_TAB_ICON = "data:image/png;base64,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";
const VENCORD_EQUICORD_TAB_ICON = "data:image/png;base64,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";

function GhostcordTabIcon() {
    return <img src={GHOSTCORD_TAB_ICON} alt="Ghostcord" style={{ width: 18, height: 18, borderRadius: 4 }} />;
}

function VencordEquicordTabIcon() {
    return <img src={VENCORD_EQUICORD_TAB_ICON} alt="Vencord & Equicord" style={{ width: 18, height: 18, borderRadius: 4 }} />;
}

function UserPluginsTabIcon() {
    return <img src="https://equicord.org/assets/icons/misc/userplugin.png" alt={t("User Plugins")} style={{ width: 18, height: 18, borderRadius: 4 }} />;
}

function LikedPluginsTabIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="#fff" d="M12.47 21.73a.92.92 0 0 1-.94 0C9.43 20.48 1 15.09 1 8.75A5.75 5.75 0 0 1 6.75 3c2.34 0 3.88.9 5.25 2.26A6.98 6.98 0 0 1 17.25 3 5.75 5.75 0 0 1 23 8.75c0 6.34-8.42 11.73-10.53 12.98Z" />
        </svg>
    );
}

const makeCategoryOptions = (othersCount?: number) => [
    { label: "Vencord & Equicord", value: SearchStatus.OTHERS },
    { label: "Ghostcord", value: SearchStatus.GHOSTCORD },
    { label: t("User Plugins"), value: SearchStatus.USER_PLUGINS },
    { label: t("Liked Plugins"), value: SearchStatus.LIKED_PLUGINS },
    { label: t("Community Plugins"), value: "community", disabled: true }
];
export const cl = classNameFactory("vc-plugins-");
export const logger = new Logger("PluginSettings", "#a6d189");

function showErrorToast(message: string) {
    Toasts.show({
        message,
        type: Toasts.Type.FAILURE,
        id: Toasts.genId(),
        options: {
            position: Toasts.Position.BOTTOM
        }
    });
}

function ReloadRequiredCard({ required, enabledPlugins, openWarningModal, resetCheckAndDo, applyDefaultConfigCheckAndDo }) {
    return (
        <Card className={classes(cl("info-card"), required && "vc-warning-card")}>
            {required ? (
                <>
                    <HeadingTertiary>{t("Restart required!")}</HeadingTertiary>
                    <Paragraph className={cl("dep-text")}>
                        {t("Restart now to apply new plugins and their settings")}
                    </Paragraph>
                    <Button variant="primary" className={cl("restart-button")} onClick={() => relaunch()}>
                        {t("Restart")}
                    </Button>
                </>
            ) : (
                <>
                    <HeadingTertiary>{t("Plugin Management")}</HeadingTertiary>
                    <Paragraph>{t("Press the cog wheel or info icon to get more info on a plugin")}</Paragraph>
                    <Paragraph>{t("Plugins with a cog wheel have settings you can modify!")}</Paragraph>
                </>
            )}
            <div style={{ display: "flex", gap: "8px" }}>
                {enabledPlugins.length > 0 && !required && (
                    <Button
                        variant="secondary"
                        size="small"
                        className={"vc-plugins-disable-warning vc-modal-align-reset"}
                        onClick={() => {
                            return openWarningModal(null, undefined, false, enabledPlugins.length, resetCheckAndDo);
                        }}
                    >
                        {t("Disable All Plugins")}
                    </Button>
                )}
                {!required && (
                    <Button
                        variant="secondary"
                        size="small"
                        className={"vc-plugins-disable-warning vc-modal-align-reset"}
                        onClick={() => {
                            return openResetDefaultsModal(applyDefaultConfigCheckAndDo);
                        }}
                    >
                        {t("Apply Default Config")}
                    </Button>
                )}
            </div>
        </Card>
    );
}

export const ExcludedReasons: Record<"web" | "discordDesktop" | "vesktop" | "equibop" | "desktop" | "dev", string> = {
    desktop: "Discord Desktop app or Vesktop/Equibop",
    discordDesktop: "Discord Desktop app",
    vesktop: "Vesktop/Equibop apps",
    equibop: "Vesktop/Equibop apps",
    web: "Vesktop/Equibop apps & Discord web",
    dev: "Developer version of Ghostcord"
};

function ExcludedPluginsList({ search }: { search: string; }) {
    const matchingExcludedPlugins = search
        ? Object.entries(ExcludedPlugins)
            .filter(([name]) => name.toLowerCase().includes(search))
        : [];

    return (
        <Paragraph className={Margins.top16}>
            {matchingExcludedPlugins.length
                ? <>
                    <Paragraph>{t("Are you looking for:")}</Paragraph>
                    <ul>
                        {matchingExcludedPlugins.map(([name, reason]) => (
                            <li key={name}>
                                <b>{name}</b>: Only available on the {ExcludedReasons[reason]}
                            </li>
                        ))}
                    </ul>
                </>
                : t("No plugins meet the search criteria.")
            }
        </Paragraph>
    );
}

import { SearchStatus, TUTORIAL_CACHE } from "./components/Common";

// Fallback native select if Discord component not found
function NativeSelect({ options, select, isSelected }: any) {
    const currentVal = options.find((o: any) => isSelected(o.value))?.value ?? options.find((o: any) => o.default)?.value ?? options[0]?.value;
    return (
        <select
            style={{
                background: "var(--background-secondary)",
                color: "var(--text-normal)",
                border: "1px solid var(--background-modifier-accent)",
                borderRadius: 4,
                padding: "6px 10px",
                fontSize: 14,
                cursor: "pointer",
                outline: "none",
            }}
            value={currentVal}
            onChange={e => select(Number(e.target.value))}
        >
            {options.map((o: any) => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    );
}

const Select = DiscordSelect || NativeSelect;
interface PluginSettingsProps {
    premiumOnly?: boolean;
}

export default function PluginSettings({ premiumOnly = false }: PluginSettingsProps) {
    const settings = useSettings();
    const changes = React.useMemo(() => new ChangeList<string>(), []);

    // Expand Discord's content column to fill the full available width
    React.useEffect(() => {
        const col = document.querySelector<HTMLElement>('[class*="contentColumn"]');
        if (!col) return;
        const prevPaddingLeft = col.style.paddingLeft;
        const prevPaddingRight = col.style.paddingRight;
        const prevMaxWidth = col.style.maxWidth;
        col.style.paddingLeft = "16px";
        col.style.paddingRight = "16px";
        col.style.maxWidth = "none";
        return () => {
            col.style.paddingLeft = prevPaddingLeft;
            col.style.paddingRight = prevPaddingRight;
            col.style.maxWidth = prevMaxWidth;
        };
    }, []);

    // Static list — no fetch, no CORS issues.
    // Also populate TUTORIAL_CACHE so the SearchStatus.TUTORIAL filter works.
    const tutorialPlugins = useMemo(() => {
        for (const name of Object.values(Plugins).map(p => p.name).filter(Boolean)) {
            TUTORIAL_CACHE.set(name, TUTORIAL_PLUGIN_NAMES.has(name));
        }
        return TUTORIAL_PLUGIN_NAMES;
    }, []);

    React.useEffect(() => {
        return () => {
            if (!changes.hasChanges) return;

            const allChanges = [...changes.getChanges()];
            const pluginNames = [...new Set(allChanges.map(s => s.split(":")[0]))];
            const maxDisplay = 15;
            const displayed = pluginNames.slice(0, maxDisplay);
            const remainingCount = pluginNames.length - displayed.length;

            Alerts.show({
                title: "Restart required",
                body: (
                    <div>
                        {displayed.map((s, i) => (
                            <span key={i}>
                                {i > 0 && ", "}
                                {Parser.parse("`" + s + "`")}
                            </span>
                        ))}
                        {remainingCount > 0 && <span> and {remainingCount} more</span>}
                    </div>
                ),
                confirmText: "Restart now",
                cancelText: "Later!",
                onConfirm: () => relaunch()
            });
        };
    }, []);

    const depMap = useMemo(() => {
        const o = {} as Record<string, string[]>;
        for (const plugin in Plugins) {
            const deps = Plugins[plugin].dependencies;
            if (deps) {
                for (const dep of deps) {
                    o[dep] ??= [];
                    o[dep].push(plugin);
                }
            }
        }
        return o;
    }, []);

    const [ratings, setRatings] = React.useState<PluginRatings>({});
    React.useEffect(() => {
        fetchPluginRatings().then(setRatings).catch(() => {});
    }, []);

    const [isLikeLoggedIn, setIsLikeLoggedIn] = React.useState(true);
    const [likeLoginLoading, setLikeLoginLoading] = React.useState(false);
    React.useEffect(() => {
        let cancelled = false;
        const refresh = () => getStoredToken().then(token => { if (!cancelled) setIsLikeLoggedIn(!!token); });
        refresh();
        window.addEventListener(LIKE_AUTH_EVENT, refresh);
        return () => {
            cancelled = true;
            window.removeEventListener(LIKE_AUTH_EVENT, refresh);
        };
    }, []);

    const handleLikeLogin = useCallback(async () => {
        if (likeLoginLoading) return;
        setLikeLoginLoading(true);
        try {
            const token = await authorizeLikeSystem();
            if (token) {
                setIsLikeLoggedIn(true);
                fetchPluginRatings(true).then(setRatings).catch(() => {});
            }
        } finally {
            setLikeLoginLoading(false);
        }
    }, [likeLoginLoading]);

    const sortedPlugins = useMemo(() => Object.values(Plugins)
        .filter(p => typeof p.name === "string")
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")), []);

    const hasUserPlugins = useMemo(() => !IS_STANDALONE && Object.values(PluginMeta).some(m => m.userPlugin), []);

    const [searchValue, setSearchValue] = useState({ value: "", status: SearchStatus.GHOSTCORD });
    const [searchInput, setSearchInput] = useState("");

    const debouncedSetSearch = useMemo(
        () => debounce((query: string) => setSearchValue(prev => ({ ...prev, value: query })), 150),
        []
    );

    const search = searchValue.value.toLowerCase();
    const onSearch = useCallback((query: string) => {
        setSearchInput(query);
        debouncedSetSearch(query);
    }, [debouncedSetSearch]);

    const BATCH_SIZE = 40;
    const [visibleCount, setVisibleCount] = React.useState(BATCH_SIZE);

    const observer = React.useRef<IntersectionObserver>();
    const sentinelRef = React.useCallback((node: HTMLDivElement | null) => {
        if (observer.current) observer.current.disconnect();
        if (node) {
            observer.current = new IntersectionObserver(
                entries => {
                    if (entries[0].isIntersecting) {
                        const total = allDataLengthRef.current;
                        React.startTransition(() => {
                            setVisibleCount(v => Math.min(v + BATCH_SIZE, total));
                        });
                    }
                },
                { rootMargin: "400px" } // trigger loading before it comes into view
            );
            observer.current.observe(node);
        }
    }, []);

    const onStatusChange = useCallback((status: SearchStatus) => {
        setVisibleCount(BATCH_SIZE);
        React.startTransition(() => {
            setSearchValue(prev => ({ ...prev, status }));
        });
    }, []);

    const pluginFilter = useCallback((plugin: typeof Plugins[keyof typeof Plugins], newPluginsSet: Set<string> | null) => {
        // Filter by premium status first
        const isPremiumPlugin = !!plugin.premium;
        if (premiumOnly) {
            if (!isPremiumPlugin) return false;
        } else {
            if (isPremiumPlugin) return false;
        }

        const { status } = searchValue;
        const enabled = isPluginEnabled(plugin.name);

        const pluginMeta = PluginMeta[plugin.name];

        switch (status) {
            case SearchStatus.DISABLED:
                if (enabled) return false;
                break;
            case SearchStatus.ENABLED:
                if (!enabled) return false;
                break;
            case SearchStatus.GHOSTCORD:
                if (!pluginMeta?.folderName?.startsWith("src/ghostcordplugins/")) return false;
                break;
            case SearchStatus.OTHERS:
                if (pluginMeta?.folderName?.startsWith("src/ghostcordplugins/") || pluginMeta?.folderName?.startsWith("src/plugins/_")) return false;
                if (!pluginMeta?.folderName?.startsWith("src/plugins/")) return false;
                break;
            case SearchStatus.VENCORD:
                if (!pluginMeta?.folderName?.startsWith("src/plugins/")) return false;
                break;
            case SearchStatus.NEW:
                if (!newPluginsSet?.has(plugin.name)) return false;
                break;
            case SearchStatus.USER_PLUGINS:
                if (!pluginMeta?.userPlugin) return false;
                break;
            case SearchStatus.API_PLUGINS:
                if (!plugin.name.endsWith("API")) return false;
                break;
            case SearchStatus.TUTORIAL:
                if (!TUTORIAL_CACHE.get(plugin.name)) return false;
                break;
            case SearchStatus.LIKED_PLUGINS:
                if (!pluginMeta?.folderName?.startsWith("src/ghostcordplugins/")) return false;
                if (!ratings[plugin.name]?.likedByMe) return false;
                break;
        }

        if (!search.length) return true;

        const isGhostcordPartner = (
            plugin.name === "DynamicIslande" ||
            plugin.name === "StereoInstaller" ||
            plugin.name === "ClientDiagnostics" ||
            plugin.name === "SecureBookmarks" ||
            plugin.name === "StatusCycler" ||
            plugin.name === "MutualScanner"
        );

        if ((search.includes("ghostcord") || search.includes("illegal")) && isGhostcordPartner) {
            return true;
        }

        return (
            plugin.name.toLowerCase().includes(search.replace(/\s+/g, "")) ||
            plugin.description.toLowerCase().includes(search) ||
            plugin.tags?.some(t => t.toLowerCase().includes(search))
        );
    }, [searchValue, search, ratings]);

    const [newPluginsSet] = useAwaiter(() => DataStore.get("Vencord_existingPlugins").then((cachedPlugins: Record<string, number> | undefined) => {
        const now = Date.now() / 1000;
        const existingTimestamps: Record<string, number> = {};
        const sortedPluginNames = Object.values(sortedPlugins).map(plugin => plugin.name);

        const newPlugins: string[] = [];
        for (const { name: p } of sortedPlugins) {
            const time = existingTimestamps[p] = cachedPlugins?.[p] ?? now;
            if ((time + 60 * 60 * 24 * 2) > now) {
                newPlugins.push(p);
            }
        }
        DataStore.set("Vencord_existingPlugins", existingTimestamps);

        return lodash.isEqual(newPlugins, sortedPluginNames) ? null : new Set(newPlugins);
    }));

    const handleRestartNeeded = useCallback((name: string, key: string) => changes.handleChange(`${name}:${key}`), [changes]);

    // Only filter/categorize plugin DATA here — no JSX created yet
        const { ghostcordData, othersData, requiredData } = useMemo(() => {
        const ghostcordData: typeof sortedPlugins = [];
        const othersData: typeof sortedPlugins = [];
        const requiredData: typeof sortedPlugins = [];

        const showApi = searchValue.status === SearchStatus.API_PLUGINS;
        for (const p of sortedPlugins) {
            if (p.hidden || (!p.settings?.def && p.name.endsWith("API") && !showApi))
                continue;

            if (!pluginFilter(p, newPluginsSet)) continue;

            const isRequired = p.required || p.isDependency || depMap[p.name]?.some(d => isPluginEnabled(d));

            if (isRequired) {
                requiredData.push(p);
            } else {
                const folderName = PluginMeta[p.name]?.folderName ?? "";
                if (folderName.startsWith("src/ghostcordplugins/")) {
                    ghostcordData.push(p);
                } else {
                    othersData.push(p);
                }
            }
        }
        // Always sort by likes descending (most liked first)
        const byLikes = (a: typeof sortedPlugins[number], b: typeof sortedPlugins[number]) =>
            (ratings[b.name]?.likes ?? 0) - (ratings[a.name]?.likes ?? 0);
        ghostcordData.sort(byLikes);
        othersData.sort(byLikes);

        return { ghostcordData, othersData, requiredData };
    }, [sortedPlugins, searchValue, newPluginsSet, depMap, pluginFilter, ratings]);

    const allDataLength = ghostcordData.length + othersData.length;
    const hasMore = visibleCount < allDataLength;

    // Store allDataLength in a ref so the observer callback always sees the latest value
    // without needing it as a dependency (which would cause reconnect loops).
    const allDataLengthRef = React.useRef(allDataLength);
    allDataLengthRef.current = allDataLength;

    // Sentinel ref and observer are now defined using a callback ref above.

    function resetCheckAndDo() {
        let restartNeeded = false;

        for (const plugin of enabledPlugins) {
            const pluginSettings = settings.plugins[plugin];

            if (Plugins[plugin].patches?.length) {
                pluginSettings.enabled = false;
                changes.handleChange(plugin);
                restartNeeded = true;
                continue;
            }

            const result = stopPlugin(Plugins[plugin]);

            if (!result) {
                logger.error(`Error while stopping plugin ${plugin}`);
                showErrorToast(`Error while stopping plugin ${plugin}`);
                continue;
            }

            pluginSettings.enabled = false;
        }

        if (restartNeeded) {
            Alerts.show({
                title: "Restart Required",
                body: (
                    <>
                        <p style={{ textAlign: "center" }}>Some plugins require a restart to fully disable.</p>
                        <p style={{ textAlign: "center" }}>Would you like to restart now?</p>
                    </>
                ),
                confirmText: "Restart Now",
                cancelText: "Later",
                onConfirm: () => relaunch()
            });
        }
    }

    function applyDefaultConfigCheckAndDo() {
        try {
            let restartNeeded = false;
            let modifiedCount = 0;

            for (const pluginName in Plugins) {
                const plugin = Plugins[pluginName];

                // API plugins cannot be configured directly
                if (pluginName.endsWith("API")) continue;

                const shouldBeEnabled = Boolean(plugin.required) || Boolean(plugin.enabledByDefault);
                const currentlyEnabled = isPluginEnabled(pluginName);

                if (currentlyEnabled !== shouldBeEnabled) {
                    const pluginSettings = settings.plugins[pluginName];

                    if (plugin.patches?.length) {
                        pluginSettings.enabled = shouldBeEnabled;
                        changes.handleChange(pluginName);
                        restartNeeded = true;
                        modifiedCount++;
                        continue;
                    }

                    if (shouldBeEnabled) {
                        const result = startPlugin(plugin);
                        if (!result) {
                            logger.error(`Error while starting plugin ${pluginName}`);
                            showErrorToast(`Error while starting plugin ${pluginName}`);
                        } else {
                            pluginSettings.enabled = true;
                            modifiedCount++;
                        }
                    } else {
                        const result = stopPlugin(plugin);
                        if (!result) {
                            logger.error(`Error while stopping plugin ${pluginName}`);
                            showErrorToast(`Error while stopping plugin ${pluginName}`);
                        } else {
                            pluginSettings.enabled = false;
                            modifiedCount++;
                        }
                    }
                }
            }

            if (restartNeeded) {
                Alerts.show({
                    title: "Restart Required",
                    body: (
                        <>
                            <p style={{ textAlign: "center" }}>Some plugins require a restart to apply their default configuration.</p>
                            <p style={{ textAlign: "center" }}>Would you like to restart now?</p>
                        </>
                    ),
                    confirmText: "Restart Now",
                    cancelText: "Later",
                    onConfirm: () => relaunch()
                });
            } else {
                Toasts.show({
                    message: `Default config applied. ${modifiedCount} plugin(s) modified.`,
                    type: Toasts.Type.SUCCESS,
                    id: Toasts.genId(),
                    options: { position: Toasts.Position.BOTTOM }
                });
            }
        } catch (err: any) {
            Toasts.show({
                message: `Failed: ${err?.message ?? err}`,
                type: Toasts.Type.FAILURE,
                id: Toasts.genId(),
                options: { position: Toasts.Position.BOTTOM }
            });
            logger.error("Apply Default Config crashed:", err);
        }
    }

    // Code directly taken from supportHelper.tsx
    const { totalStockPlugins, totalUserPlugins, enabledStockPlugins, enabledUserPlugins, enabledPlugins } = useMemo(() => {
        const isApiPlugin = (plugin: string) => plugin.endsWith("API") || Plugins[plugin].required;

        const totalPlugins = Object.keys(Plugins).filter(p => !isApiPlugin(p));
        const enabledPlugins = Object.keys(Plugins).filter(p => isPluginEnabled(p) && !isApiPlugin(p));

        const totalStockPlugins = totalPlugins.filter(p => !PluginMeta[p].userPlugin && !Plugins[p].hidden).length;
        const totalUserPlugins = totalPlugins.filter(p => PluginMeta[p].userPlugin).length;
        const enabledStockPlugins = enabledPlugins.filter(p => !PluginMeta[p].userPlugin).length;
        const enabledUserPlugins = enabledPlugins.filter(p => PluginMeta[p].userPlugin).length;
        return { totalStockPlugins, totalUserPlugins, enabledStockPlugins, enabledUserPlugins, enabledPlugins };
    }, [settings.plugins]);

    // Slice DATA first, then create JSX only for visible items
    const ghostcordVisibleData = ghostcordData.slice(0, Math.min(visibleCount, ghostcordData.length));
    const othersVisibleData = othersData.slice(0, Math.max(0, visibleCount - ghostcordData.length));

    const makeCard = (p: typeof sortedPlugins[number]) => (
        <ErrorBoundary fallback={<div style={{ color: "red", padding: 8 }}>Failed to render {p.name}.</div>} key={p.name}>
            <PluginCard
                onRestartNeeded={handleRestartNeeded}
                disabled={false}
                plugin={p}
                isNew={newPluginsSet?.has(p.name)}
                hasTutorial={tutorialPlugins.has(p.name)}
            />
        </ErrorBoundary>
    );

    const makeRequiredCard = (p: typeof sortedPlugins[number]) => {
        const tooltipText = p.required || !depMap[p.name]
            ? "This plugin is required for Ghostcord to function."
            : <PluginDependencyList deps={depMap[p.name]?.filter(d => isPluginEnabled(d))} />;
        return (
            <ErrorBoundary fallback={<div style={{ color: "red", padding: 8 }}>Failed to render {p.name}.</div>} key={p.name}>
                <Tooltip text={tooltipText}>
                    {({ onMouseLeave, onMouseEnter }) => (
                        <PluginCard
                            onMouseLeave={onMouseLeave}
                            onMouseEnter={onMouseEnter}
                            onRestartNeeded={handleRestartNeeded}
                            disabled={true}
                            plugin={p}
                            hasTutorial={tutorialPlugins.has(p.name)}
                        />
                    )}
                </Tooltip>
            </ErrorBoundary>
        );
    };

    const ghostcordPlugins = ghostcordVisibleData.map(makeCard);
    const othersVisible = othersVisibleData.map(makeCard);
    const requiredPlugins = requiredData.map(makeRequiredCard);

    const totalGhostcordPlugins = React.useMemo(() => {
        return Object.values(Plugins).filter(p => PluginMeta[p.name]?.folderName?.startsWith("src/ghostcordplugins/")).length;
    }, []);

    const totalOtherPlugins = React.useMemo(() => {
        const isGhostcordPlugin = (p: string) => PluginMeta[p]?.folderName?.startsWith("src/ghostcordplugins/");
        const isCorePlugin = (p: string) => PluginMeta[p]?.folderName?.startsWith("src/plugins/_");
        return Object.values(Plugins).filter(p => !isGhostcordPlugin(p.name) && !isCorePlugin(p.name)).length;
    }, []);

    // Category-aware stats for the "ENABLED PLUGINS" card: reflects whichever tab
    // (GHOSTCORD / OTHERS / all) is currently selected, instead of always being global.
    const categoryStats = useMemo(() => {
        const isApiPlugin = (plugin: string) => plugin.endsWith("API") || Plugins[plugin].required;
        const isGhostcordPlugin = (p: string) => PluginMeta[p]?.folderName?.startsWith("src/ghostcordplugins/");
        const isUserPlugin = (p: string) => PluginMeta[p]?.userPlugin === true;

        let plugins = Object.keys(Plugins).filter(p => !isApiPlugin(p) && !Plugins[p].hidden);

        if (searchValue.status === SearchStatus.GHOSTCORD) {
            plugins = plugins.filter(isGhostcordPlugin);
        } else if (searchValue.status === SearchStatus.OTHERS) {
            plugins = plugins.filter(p => !isGhostcordPlugin(p));
        } else if (searchValue.status === SearchStatus.USER_PLUGINS) {
            plugins = plugins.filter(isUserPlugin);
        } else if (searchValue.status === SearchStatus.LIKED_PLUGINS) {
            plugins = plugins.filter(p => isGhostcordPlugin(p) && ratings[p]?.likedByMe);
        }

        const total = plugins.length;
        const enabled = plugins.filter(p => isPluginEnabled(p)).length;
        return { total, enabled };
    }, [settings.plugins, searchValue.status, ratings]);

    const percent = categoryStats.total > 0 ? Math.round((categoryStats.enabled / categoryStats.total) * 100) : 0;
    const strokeDashoffset = 62.83 - (62.83 * percent / 100);

    return (
        <SettingsTab>
            <div className="vc-plugins-full-width-container">
                {!premiumOnly && (
                    <div className={cl("ecosystem-banner")}>
                        <div className={cl("ecosystem-banner-text")}>
                            <HeadingTertiary>{t("Plugin Ecosystem Management")}</HeadingTertiary>
                            <Paragraph>{t("Manage your Ghostcord and community plugins here. Enable, disable, and configure them to your liking.")}</Paragraph>
                        </div>
                        <div className={cl("ecosystem-banner-buttons")}>
                            {!isLikeLoggedIn && (
                                <Button
                                    variant="primary"
                                    size="small"
                                    disabled={likeLoginLoading}
                                    onClick={handleLikeLogin}
                                >
                                    {t("Log in to like")}
                                </Button>
                            )}
                            <Button
                                variant="secondary"
                                size="small"
                                onClick={() => openWarningModal(null, undefined, false, enabledPlugins.length, resetCheckAndDo)}
                            >
                                {t("DISABLE ALL PLUGINS")}
                            </Button>
                            <Button
                                variant="secondary"
                                size="small"
                                onClick={() => openResetDefaultsModal(applyDefaultConfigCheckAndDo)}
                            >
                                {t("APPLY DEFAULT CONFIG")}
                            </Button>
                        </div>
                    </div>
                )}

                {!premiumOnly && (
                    <div className={cl("stats-banner")}>
                        <div className={cl("stat-item")}>
                            <div className={cl("stat-title")}>{t("TOTAL PLUGINS")}</div>
                            <div className={cl("stat-value")}>{totalStockPlugins + totalUserPlugins}</div>
                        </div>
                        <div className={cl("stat-item")}>
                            <div className={cl("stat-title")}>{t("ENABLED PLUGINS")}</div>
                            <div className={cl("stat-value")}>
                                {categoryStats.enabled} <span className={cl("stat-percent")}>({percent}%)</span>
                                <div className={cl("stat-chart")}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" style={{ transform: "rotate(-90deg)" }}>
                                        <circle cx="12" cy="12" r="10" fill="transparent" stroke="var(--background-modifier-active)" strokeWidth="4" />
                                        <circle cx="12" cy="12" r="10" fill="transparent" stroke="var(--text-link)" strokeWidth="4" strokeDasharray="62.83" strokeDashoffset={strokeDashoffset} style={{ transition: "stroke-dashoffset 0.5s ease" }} />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <div 
                            className={cl("stat-item")} 
                            style={searchValue.status === SearchStatus.USER_PLUGINS ? { cursor: "pointer", transition: "0.2s" } : {}}
                            onClick={() => {
                                if (searchValue.status !== SearchStatus.USER_PLUGINS) return;
                                const native = (window as any).DiscordNative || (window as any).VesktopNative;
                                if (native?.process?.env) {
                                    const home = native.process.env.USERPROFILE || native.process.env.HOME;
                                    if (home) {
                                        const isWindows = !!native.process.env.USERPROFILE;
                                        const folderPath = isWindows ? `${home}\\Documents\\Ghostcord\\userplugins` : `${home}/Documents/Ghostcord/userplugins`;
                                        // Open the directory itself (will open its parent and highlight it)
                                        showItemInFolder(folderPath);
                                    }
                                }
                            }}
                            title={searchValue.status === SearchStatus.USER_PLUGINS ? "Click to open folder" : ""}
                        >
                            <div className={cl("stat-title")}>
                                {searchValue.status === SearchStatus.USER_PLUGINS ? t("USER PLUGINS") : 
                                 searchValue.status === SearchStatus.OTHERS ? t("VENCORD & EQUICORD PLUGINS") : 
                                 searchValue.status === SearchStatus.LIKED_PLUGINS ? t("LIKED PLUGINS") :
                                 t("GHOSTCORD PLUGINS")}
                            </div>
                            <div className={cl("stat-value")}>
                                {searchValue.status === SearchStatus.USER_PLUGINS ? totalUserPlugins : 
                                 searchValue.status === SearchStatus.OTHERS ? totalOtherPlugins : 
                                 searchValue.status === SearchStatus.LIKED_PLUGINS ? categoryStats.total :
                                 totalGhostcordPlugins}
                            </div>
                        </div>
                    </div>
                )}

                <div className={classes(Margins.bottom20, cl("filter-controls"))}>
                    <ErrorBoundary noop>
                        <TextInput autoFocus value={searchInput} placeholder={t("Find a plugin, tag, or author...")} onChange={onSearch} />
                    </ErrorBoundary>
                    <div className={cl("filter-buttons")} style={{ minWidth: 220 }}>
                        <SearchableSelect
                            options={makeCategoryOptions(totalOtherPlugins)}
                            value={makeCategoryOptions(totalOtherPlugins).find(o => o.value === searchValue.status)?.value ?? SearchStatus.GHOSTCORD}
                            onChange={(v: any) => {
                                if (v === "community") return;
                                onStatusChange(v);
                            }}
                            closeOnSelect={true}
                            renderOptionPrefix={(o: any) => {
                                if (o?.value === SearchStatus.GHOSTCORD) return <GhostcordTabIcon />;
                                if (o?.value === SearchStatus.OTHERS) return <VencordEquicordTabIcon />;
                                if (o?.value === SearchStatus.USER_PLUGINS) return <UserPluginsTabIcon />;
                                if (o?.value === SearchStatus.LIKED_PLUGINS) return <LikedPluginsTabIcon />;
                                return null;
                            }}
                        />
                    </div>
                </div>

            {premiumOnly ? (
                <>
                    <HeadingTertiary className={Margins.top20}>Premium Plugins</HeadingTertiary>
                    {ghostcordData.length || othersData.length
                        ? (
                            <div className={cl("grid")}>
                                {[...ghostcordPlugins, ...othersVisible].length
                                    ? [...ghostcordPlugins, ...othersVisible]
                                    : <Paragraph>{t("No plugins meet the search criteria.")}</Paragraph>
                                }
                            </div>
                        )
                        : <ExcludedPluginsList search={search} />
                    }
                </>
            ) : (
                <>
                    {ghostcordData.length > 0 && searchValue.status === SearchStatus.GHOSTCORD && (
                        <div className={cl("grid")}>
                            {ghostcordPlugins}
                        </div>
                    )}
                    


                    {othersData.length > 0 && searchValue.status === SearchStatus.OTHERS && (
                        <div className={cl("grid")}>
                            {othersVisible}
                        </div>
                    )}

                    {searchValue.status === SearchStatus.USER_PLUGINS && (
                        <>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, padding: "8px 0" }}>
                                <UserPluginsTabIcon />
                                <span style={{ color: "var(--header-primary)", fontWeight: 600, fontSize: 14 }}>
                                    {t("User Plugins — from your local folder")}
                                </span>
                            </div>
                            {ghostcordPlugins.length > 0 || othersVisible.length > 0 ? (
                                <div className={cl("grid")}>
                                    {[...ghostcordPlugins, ...othersVisible]}
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)" }}>
                                    <div style={{ fontSize: 32, marginBottom: 12 }}>📁</div>
                                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{t("No user plugins found")}</div>
                                    <div style={{ fontSize: 13 }}>{t("Add .tsx files to your")} <code>Documents/Ghostcord/userplugins/</code> {t("folder and rebuild.")}</div>
                                </div>
                            )}
                        </>
                    )}

                    {ghostcordData.length === 0 && othersData.length === 0 && searchValue.status === SearchStatus.LIKED_PLUGINS && (
                        <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)" }}>
                            <div style={{ fontSize: 32, marginBottom: 12 }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto" }}>
                                    <path fill="currentColor" fillRule="evenodd" d="M12 8.07 10.6 6.7A5 5 0 0 0 6.75 5 3.75 3.75 0 0 0 3 8.75c0 2.32 1.59 4.76 3.87 6.96A31.87 31.87 0 0 0 12 19.67c1.2-.74 3.26-2.14 5.13-3.96 2.28-2.2 3.87-4.64 3.87-6.96A3.75 3.75 0 0 0 17.25 5a5 5 0 0 0-3.85 1.69L12 8.07Zm0-2.8A6.98 6.98 0 0 0 6.75 3 5.75 5.75 0 0 0 1 8.75c0 6.34 8.42 11.73 10.53 12.98.29.17.65.17.94 0C14.57 20.48 23 15.09 23 8.75A5.75 5.75 0 0 0 17.25 3c-2.34 0-3.88.9-5.25 2.26Z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{t("No liked plugins yet")}</div>
                            <div style={{ fontSize: 13 }}>{t("Like a Ghostcord plugin from its card to see it here.")}</div>
                        </div>
                    )}

                    {(searchValue.status !== SearchStatus.GHOSTCORD && searchValue.status !== SearchStatus.OTHERS && searchValue.status !== SearchStatus.USER_PLUGINS && searchValue.status !== SearchStatus.LIKED_PLUGINS) && (
                        <div className={cl("grid")}>
                            {ghostcordPlugins}
                            {othersVisible}
                        </div>
                    )}

                    {ghostcordData.length === 0 && othersData.length === 0 && searchValue.status !== SearchStatus.USER_PLUGINS && searchValue.status !== SearchStatus.LIKED_PLUGINS && (
                        <ExcludedPluginsList search={search} />
                    )}

                    {/* Sentinel: only rendered when there are more items to load */}
                    {hasMore && (
                        <div
                            ref={sentinelRef}
                            style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}
                        >
                            {t("Loading more plugins…")}
                        </div>
                    )}
                </>
            )}

            {!premiumOnly && requiredPlugins.length > 0 && (
                <>
                    <Divider className={Margins.top20} />

                    <HeadingTertiary className={classes(Margins.top20, Margins.bottom8)}>
                        {t("Required Plugins")}
                    </HeadingTertiary>
                    <div className={cl("grid")}>
                        {requiredPlugins.length
                            ? requiredPlugins
                            : <Paragraph>{t("No plugins meet the search criteria.")}</Paragraph>
                        }
                    </div>
                </>
            )}
            </div>
        </SettingsTab>
    );
}

export function PluginDependencyList({ deps }: { deps: string[]; }) {
    return (
        <>
            <Paragraph>{t("This plugin is required by:")}</Paragraph>
            {deps.map((dep: string) => <Paragraph key={dep} className={cl("dep-text")}>{dep}</Paragraph>)}
        </>
    );
}
