const fs = require("fs");
const path = require("path");

const pluginDir = path.resolve(__dirname, "..", "src", "ghostcordplugins");
const plugins = fs.readdirSync(pluginDir).filter(d => {
    const stat = fs.statSync(path.join(pluginDir, d));
    return stat.isDirectory() && d !== "messageLogger";
});

// Handle messageLogger separately since it has nested structure
const deepPlugins = ["messageLogger"];

for (const p of plugins) {
    const indexPath = path.join(pluginDir, p, "index.tsx");
    const tsPath = path.join(pluginDir, p, "index.ts");
    
    let fileToModify = fs.existsSync(indexPath) ? indexPath : fs.existsSync(tsPath) ? tsPath : null;
    if (fileToModify) {
        let content = fs.readFileSync(fileToModify, "utf8");
        content = content.replace(/\s*enabledByDefault:\s*true,?\n?/g, "\n");
        content = content.replace(/(definePlugin\(\s*\{[\s\S]*?name:\s*["'][^"']+["'],?)/, "$1\n    enabledByDefault: true,");
        fs.writeFileSync(fileToModify, content);
        console.log(`Fixed ${p}`);
    }
}

// Also fix plugins/ directory (non-ghostcord core plugins)
const corePluginDir = path.resolve(__dirname, "..", "src", "plugins");
if (fs.existsSync(corePluginDir)) {
    const corePlugins = fs.readdirSync(corePluginDir).filter(d => {
        const stat = fs.statSync(path.join(corePluginDir, d));
        return stat.isDirectory();
    });
    for (const p of corePlugins) {
        const indexPath = path.join(corePluginDir, p, "index.tsx");
        const tsPath = path.join(corePluginDir, p, "index.ts");
        
        let fileToModify = fs.existsSync(indexPath) ? indexPath : fs.existsSync(tsPath) ? tsPath : null;
        if (fileToModify) {
            let content = fs.readFileSync(fileToModify, "utf8");
            if (content.includes("definePlugin")) {
                content = content.replace(/\s*enabledByDefault:\s*true,?\n?/g, "\n");
                content = content.replace(/(definePlugin\(\s*\{[\s\S]*?name:\s*["'][^"']+["'],?)/, "$1\n    enabledByDefault: true,");
                fs.writeFileSync(fileToModify, content);
            }
            console.log(`Fixed core ${p}`);
        }
    }
}

console.log("Done!");
