import re

# Read LanguageTab.tsx
with open("src/components/settings/tabs/LanguageTab.tsx", "r", encoding="utf-8") as f:
    lang_tab_content = f.read()

# Extract the base64 constants
gb_b64 = re.search(r'const GB_B64 = "(.*?)";', lang_tab_content).group(0)
sa_b64 = re.search(r'const SA_B64 = "(.*?)";', lang_tab_content).group(0)
fr_b64 = re.search(r'const FR_B64 = "(.*?)";', lang_tab_content).group(0)
es_b64 = re.search(r'const ES_B64 = "(.*?)";', lang_tab_content).group(0)
ru_b64 = re.search(r'const RU_B64 = "(.*?)";', lang_tab_content).group(0)
cn_b64 = re.search(r'const CN_B64 = "(.*?)";', lang_tab_content).group(0)

flags = f"""
export {gb_b64}
export {sa_b64}
export {fr_b64}
export {es_b64}
export {ru_b64}
export {cn_b64}

export const LANGUAGE_FLAGS: Record<Language, string> = {{
    en: GB_B64,
    ar: SA_B64,
    fr: FR_B64,
    es: ES_B64,
    ru: RU_B64,
    zh: CN_B64,
}};
"""

# Update i18n.ts
with open("src/api/i18n.ts", "r", encoding="utf-8") as f:
    i18n_content = f.read()

i18n_content = re.sub(
    r'export const LANGUAGE_FLAGS: Record<Language, string> = \{[^\}]+\};',
    flags.strip(),
    i18n_content
)

with open("src/api/i18n.ts", "w", encoding="utf-8") as f:
    f.write(i18n_content)

# Update LanguageTab.tsx
lang_tab_content = re.sub(r'const GB_B64 = ".*?";\n', '', lang_tab_content)
lang_tab_content = re.sub(r'const SA_B64 = ".*?";\n', '', lang_tab_content)
lang_tab_content = re.sub(r'const FR_B64 = ".*?";\n', '', lang_tab_content)
lang_tab_content = re.sub(r'const ES_B64 = ".*?";\n', '', lang_tab_content)
lang_tab_content = re.sub(r'const RU_B64 = ".*?";\n', '', lang_tab_content)
lang_tab_content = re.sub(r'const CN_B64 = ".*?";\n', '', lang_tab_content)

lang_tab_content = re.sub(
    r'const FLAG_ICONS: Record<Language, string> = \{[^\}]+\};',
    '',
    lang_tab_content
)

# Replace FLAG_ICONS usage in LanguageTab.tsx with LANGUAGE_FLAGS
lang_tab_content = lang_tab_content.replace('FLAG_ICONS[lang]', 'LANGUAGE_FLAGS[lang]')

with open("src/components/settings/tabs/LanguageTab.tsx", "w", encoding="utf-8") as f:
    f.write(lang_tab_content)

print("Done")
