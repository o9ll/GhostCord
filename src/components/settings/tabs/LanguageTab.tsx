/*
 * Ghostcord, a Discord client mod
 * Copyright (c) 2026 Ghostcord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LANGUAGES, LANGUAGE_FLAGS, Language, t } from "@api/i18n";
import { useSettings } from "@api/Settings";
import { Divider } from "@components/Divider";
import { Heading } from "@components/Heading";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import { Margins } from "@utils/margins";
import { SearchableSelect } from "@webpack/common";

const FLAG_ICON_STYLE: React.CSSProperties = { width: 20, height: 15, borderRadius: 2, verticalAlign: "middle", objectFit: "cover" };


const LANG_PREVIEW: Record<Language, { label: string; sample: string; }> = {
    en: { label: "English", sample: "Plugins · Themes · Updater · Sync" },
    ar: { label: "Saudi", sample: "إضافات · سمات · محدث · مزامنة" },
    fr: { label: "France", sample: "Plugins · Thèmes · Mises à jour · Synchronisation" },
    es: { label: "Spain", sample: "Plugins · Temas · Actualizador · Sincronización" },
    ru: { label: "Russia", sample: "Плагины · Темы · Обновления · Синхронизация" },
    zh: { label: "China", sample: "插件 · 主题 · 更新 · 同步" },
};

const languageOptions = (Object.keys(LANGUAGES) as Language[]).map(lang => ({
    label: LANG_PREVIEW[lang]?.label ?? LANGUAGES[lang],
    value: lang,
}));

function FlagIcon({ lang }: { lang: Language; }) {
    if (!LANGUAGE_FLAGS[lang]) {
        return <div style={{...FLAG_ICON_STYLE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px"}}>{LANGUAGE_FLAGS[lang]}</div>;
    }
    return <img src={LANGUAGE_FLAGS[lang]} alt={lang} style={FLAG_ICON_STYLE} />;
}

function LanguageTab() {
    const settings = useSettings(["language"]);
    const current = (settings.language as Language) ?? "en";

    function selectLang(lang: Language) {
        settings.language = lang;
    }

    return (
        <SettingsTab>
            <Heading className={Margins.top16}>{t("Interface Language")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {t("Choose the language for Ghostcord's interface. Plugin names and Discord's own UI are not affected.")}
            </Paragraph>

            <Notice.Info className={Margins.bottom20}>
                {t("Translations are community-maintained and may be incomplete. If you'd like to help translate Ghostcord, contributions are welcome!")}
            </Notice.Info>

            {/* Dropdown sélectif — même composant/pattern que "Cloud Backend" dans CloudTab */}
            <div className={Margins.bottom8}>
                <SearchableSelect
                    options={languageOptions}
                    value={languageOptions.find(o => o.value === current)?.value}
                    onChange={v => selectLang(v as Language)}
                    closeOnSelect={true}
                    renderOptionPrefix={o => o?.value ? <FlagIcon lang={o.value as Language} /> : null}
                />
            </div>

            <Paragraph className={`${Margins.bottom16} ${Margins.top8}`} style={{ color: "var(--text-muted)", fontSize: 13 }}>
                {current && LANG_PREVIEW[current] ? LANG_PREVIEW[current].sample : ""}
            </Paragraph>

            <Divider className={Margins.top8} />

            <Notice.Warning className={Margins.top16}>
                <strong>{t("Reload required")}</strong> — {t("Please reload Discord after changing the language for all changes to take effect.")}
            </Notice.Warning>
        </SettingsTab>
    );
}

export default wrapTab(LanguageTab, "Language");
