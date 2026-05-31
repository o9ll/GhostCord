import {execFile} from "child_process";
import path from "path";
import findProcess from "find-process";
import kill from "tree-kill";
import {shell} from "electron";
import {progress} from "../../stores/installation";
import {log} from "./log";

const platforms = {stable: "Discord", ptb: "Discord PTB", canary: "Discord Canary"};
const windowsExecutables = {
    stable: "Discord.exe",
    ptb: "DiscordPTB.exe",
    canary: "DiscordCanary.exe"
};

function execFileAsync(file, args) {
    return new Promise((resolve, reject) => {
        execFile(file, args, (err, stdout = "", stderr = "") => {
            if (err) reject(err);
            else resolve({stdout, stderr});
        });
    });
}

async function killWindowsProcesses(channels, shouldRestart) {
    const binByChannel = new Map();
    const results = await execFileAsync("tasklist", []);

    for (const channel of channels) {
        const processName = windowsExecutables[channel];
        if (!processName || !results.stdout.includes(processName)) {
            log(`✅ ${platforms[channel]} not running`);
            continue;
        }

        try {
            const found = await findProcess("name", processName.replace(".exe", ""), true);
            const parentPids = found.map(p => p.ppid);
            const discordPid = found.find(p => parentPids.includes(p.pid)) ?? found[0];
            if (discordPid?.bin) binByChannel.set(channel, discordPid.bin);
        } catch {}

        log("Attempting to kill " + processName.replace(".exe", ""));
        await execFileAsync("taskkill", ["/IM", processName, "/F", "/T"]);
    }

    if (!shouldRestart) return;

    for (const channel of channels) {
        const bin = binByChannel.get(channel);
        if (bin) setTimeout(() => shell.openPath(bin), 1000);
    }
}

export default async function killProcesses(channels, progressPerLoop, shouldRestart = true) {
    try {
        if (process.platform === "win32") {
            await killWindowsProcesses(channels, shouldRestart);
            for (const channel of channels) {
                progress.set(progress.value + progressPerLoop);
            }
            return;
        }

        for (const channel of channels) {
            let processName = platforms[channel];
            if (process.platform === "darwin") processName = platforms[channel];
            else processName = platforms[channel].replace(" ", "");

            log("Attempting to kill " + processName);
            const results = await findProcess("name", processName, true);
            if (!results || !results.length) {
                log(`✅ ${processName} not running`);
                progress.set(progress.value + progressPerLoop);
                continue;
            }

            const parentPids = results.map(p => p.ppid);
            const discordPid = results.find(p => parentPids.includes(p.pid)) ?? results[0];
            const bin = process.platform === "darwin" ? path.resolve(discordPid.bin, "..", "..", "..") : discordPid.bin;
            await new Promise(r => kill(discordPid.pid, r));
            if (shouldRestart) setTimeout(() => shell.openPath(bin), 1000);
            progress.set(progress.value + progressPerLoop);
        }
    }
    catch (err) {
        const symbol = shouldRestart ? "⚠️" : "❌";
        log(`${symbol} Could not kill Discord processes`);
        log(`${symbol} ${err.message}`);
        return err;
    }
}