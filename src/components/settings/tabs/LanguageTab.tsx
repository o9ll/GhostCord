/*
 * Nightcord, a Discord client mod
 * Copyright (c) 2026 Nightcord contributors
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

const GB_B64 = "data:image/png;base64,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";
const FR_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAMAAACWlYwtAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAABCUExURQAAAA4vWg0uWhY1X8HDzv/39/z09fzy8t5icM0NIs4QJQAmVAAlUwgtWcDJ1P////78/N9jcc0NIs4RJggsWQAAAEloUqIAAAALdFJOUwD+/v77+vr68+/vTLYzhQAAAAFiS0dEAIgFHUgAAAAHdElNRQfqBhMSFRsUlcdzAAAAS0lEQVRIx+3WuQ3AIBAAQbDxw+uP/msl5y5BskSyW8DEa8z0Yl/K5ZLdz/upAQAAAAAAAAAAAKhAEtUxwPYtq9t20XH6oDb7tH+oAfO2omCCeGkGAAAAAElFTkSuQmCC";
const ES_B64 = "data:image/png;base64,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";
const RU_B64 = "data:image/png;base64,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";
const CN_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAMAAACWlYwtAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAFZUExURQAAAO4cJe4cJO0bJe0aJe4iJO4jI/A2IO8tIu4bJe8qIvaSEvrBCvFPHPA8IO4iI+8pIvm5C/71AvaREu8uIu4hJPeeEPBBHu0ZJe8uIfJTHPaNE+8wIe4bJPA9H/zlBPR1Fu0YJe4oI+4eJO4nI+4gJO4dJO0UJvRwF///APmxDe0XJfFOHfaQEvRwGO4lI/JUHPJaG/JZG/JYG/q9C/3mBPRqGPA3IO8sIveVEf79APiqDu4fJPV6Fv3lBP78AP75Af7+AP76AfilD+80Ie4kI/m1DPR2Fu8yIfJUG/vMCP3oA/V7FfvRB/70AfNiGe8zIfzcBf76APNlGf77APzgBfWEFPq/CvilDvNkGfijD/rCCvFGHveXEfvQCPWGFPzdBvedD/A4IPRuGPFEHvR3Fv3uA/ecEPFLHfFNHfFRHPaME/m7C/FMHfm4C/73Ae8xIfJcGgAAAJcSm1cAAAABdFJOUwBA5thmAAAAAWJLR0QAiAUdSAAAAAd0SU1FB+oGExIVGxSVx3MAAAGESURBVEjH7ZRJU8JAFITJvBGMuEQEjWjQIQaNURFQQcQFxH1BxX3f9/X/XwwhpsoqDi9ysLTSl+SQ/jLT0/Ncrl8XV6UqAAgABVIFAGrcnlpqH8B//RbqvPUNALYB0NhUNoHQ7GvxY5dgASDQ2iYab7Q92NEpAeAWYQHEUFc3M/ZAKAvL0KPwEQyhBCDAGOvtU/sljTFaggBoA4NDUSwAwsOxeGJEHR1LxGNJwwWp8fREBg1wT05Nz6TVbC7nm80b6cFccH5hERNkeQt0aTmr6lpZdYvlHEAJiRI+RGCeNd2/XmBWBbFtNE+BbmyqaXWrqFkmIvMcjwew4vbO7p66L5m58SRzECV4AJDDo2MtdXKaN3Oj/rPzi0tsiKX2XqVEjsqFa9FMAG5u79BF0r+PEL1A+mnIYLgp0PuHRwUP4MzeGw9QZI8ARKQ2Mvgm6n96fpHsX2dLEH1986InSqUVvH94kz8YKJb0yykEsH6u4lTWx2o1Q9WeHIADcAAO4D8B/r4+AYMpLvgOneYKAAAAAElFTkSuQmCC";

const FLAG_ICONS: Record<Language, string> = {
    en: GB_B64,
    fr: FR_B64,
    es: ES_B64,
    ru: RU_B64,
    zh: CN_B64,
};

const LANG_PREVIEW: Record<Language, { label: string; sample: string; }> = {
    en: { label: "English", sample: "Plugins · Themes · Updater · Sync" },
    fr: { label: "Français", sample: "Plugins · Thèmes · Mises à jour · Synchronisation" },
    es: { label: "Español", sample: "Plugins · Temas · Actualizador · Sincronización" },
    ru: { label: "Русский", sample: "Плагины · Темы · Обновления · Синхронизация" },
    zh: { label: "中文", sample: "插件 · 主题 · 更新 · 同步" },
    ar: { label: "العربية", sample: "إضافات · سمات · محدث · مزامنة" },
};

const languageOptions = (Object.keys(LANGUAGES) as Language[]).map(lang => ({
    label: LANG_PREVIEW[lang]?.label ?? LANGUAGES[lang],
    value: lang,
}));

function FlagIcon({ lang }: { lang: Language; }) {
    if (!FLAG_ICONS[lang]) {
        return <div style={{...FLAG_ICON_STYLE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px"}}>{LANGUAGE_FLAGS[lang]}</div>;
    }
    return <img src={FLAG_ICONS[lang]} alt={lang} style={FLAG_ICON_STYLE} />;
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
                {t("Choose the language for Nightcord's interface. Plugin names and Discord's own UI are not affected.")}
            </Paragraph>

            <Notice.Info className={Margins.bottom20}>
                {t("Translations are community-maintained and may be incomplete. If you'd like to help translate Nightcord, contributions are welcome!")}
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
