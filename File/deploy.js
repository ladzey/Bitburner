/** 
 * @param {NS} ns 
 *
 * Usage:
 *   run deploy.js 2 "hack.js,grow.js" true "n00dles"
 *
 * where:
 *   ns.args[0] = maximum hop level (e.g., 2)
 *   ns.args[1] = comma-separated list of scripts (e.g., "hack.js,grow.js")
 *   ns.args[2] = toggle for excluding private servers (true/false)
 *   ns.args[3] = target for the deployed scripts (e.g., "n00dles")
 */
export async function main(ns) {
    // ====== CONFIGURATION ======
    // Default scripts to deploy if none are provided via the terminal.
    const defaultScripts = ["hack.js"];
    
    // Get the maximum hop level from argument 0 (default: 1)
    const targetHop = ns.args.length > 0 ? Number(ns.args[0]) : 1;
    if (isNaN(targetHop) || targetHop <= 0) {
        ns.tprint("ERROR: Invalid hop count. Please enter a positive number.");
        return;
    }
    
    // Allow the user to supply a comma-separated list of script names as the second argument.
    // If not provided, use the default scripts.
    const scriptsToDeploy = ns.args.length > 1 
                              ? String(ns.args[1]).split(",").map(s => s.trim()).filter(s => s.length > 0)
                              : defaultScripts;
    
    // Toggle for excluding private servers.
    // If true, any server whose name starts with "pserv-" will be skipped.
    // This value is provided as the third argument.
    const EXCLUDE_PRIVATE_SERVERS = ns.args.length > 2 ? (ns.args[2] === true || ns.args[2] === "true") : false;
    
    // Allow an optional target for the deployed scripts (the hacking target).
    // If not provided, the target argument will be an empty string.
    const hackTarget = ns.args.length > 3 ? ns.args[3] : "";
    
    // Manually excluded servers (these will never be processed)
    const manualExcludedServers = [];
    // ============================

    ns.tprint(`Deploying scripts: ${scriptsToDeploy.join(", ")}`);
    ns.tprint(`Maximum hop level: ${targetHop}`);
    ns.tprint(`Exclude private servers: ${EXCLUDE_PRIVATE_SERVERS}`);
    ns.tprint(`Hack target: ${hackTarget ? hackTarget : "None specified"}`);

    // Scan all servers up to targetHop from "home"
    const scannedServers = getServersUpToLevel(ns, targetHop);

    // Determine which servers are manually excluded...
    const manuallyExcluded = scannedServers.filter(server => manualExcludedServers.includes(server));
    // ...and which servers are considered private (name starts with "pserv-")
    const privateExcluded = EXCLUDE_PRIVATE_SERVERS 
                              ? scannedServers.filter(server => server.startsWith("pserv-"))
                              : [];
    
    // Build candidate servers by excluding both manual and (if toggled) private servers.
    const candidateServers = scannedServers.filter(server => {
        if (manualExcludedServers.includes(server)) return false;
        if (EXCLUDE_PRIVATE_SERVERS && server.startsWith("pserv-")) return false;
        return true;
    });

    // Print a summary of the excluded servers.
    ns.tprint("============================================================");
    ns.tprint(`Manually excluded servers: ${manuallyExcluded.length ? manuallyExcluded.join(", ") : "None"}`);
    ns.tprint(`Private servers excluded: ${privateExcluded.length ? privateExcluded.join(", ") : "None"}`);
    ns.tprint("============================================================");

    // Build arrays for valid servers and those skipped due to insufficient port openers.
    let validServers = [];
    let portExcludedServers = [];
    for (const server of candidateServers) {
        if (!canNuke(ns, server)) {
            ns.tprint(`Skipping server ${server} because not enough port openers are available to nuke it.`);
            portExcludedServers.push(server);
            continue;
        }
        validServers.push(server);
    }
    
    // Print a summary of the skipped servers (due to insufficient port openers).
    ns.tprint("============================================================");
    ns.tprint(`Servers skipped due to insufficient port openers: ${portExcludedServers.length ? portExcludedServers.join(", ") : "None"}`);
    ns.tprint("============================================================");
    
    // (Optional) Separate valid servers based on port requirements (for logging)
    const serversNoPorts = [];
    const serversWithPorts = [];
    for (const server of validServers) {
        const portsRequired = ns.getServerNumPortsRequired(server);
        if (portsRequired === 0) {
            serversNoPorts.push(server);
        } else {
            serversWithPorts.push(server);
        }
    }
    ns.tprint(`Valid servers (up to ${targetHop} hops) requiring no ports: ${serversNoPorts.join(", ")}`);
    ns.tprint(`Valid servers (up to ${targetHop} hops) requiring ports: ${serversWithPorts.join(", ")}`);
    
    // Proceed: copy scripts, gain root access and deploy.
    for (const server of validServers) {
        await ns.scp(scriptsToDeploy, server);
    }
    
    // Pass the hackTarget to gainRootAccess so that each deployed script receives it.
    for (const server of validServers) {
        gainRootAccess(ns, server, scriptsToDeploy, hackTarget);
    }
}

/**
 * Returns all servers that are within the specified hop level from "home" using a breadth-first search.
 * Only servers with level > 0 and ≤ maxHop are returned.
 *
 * @param {NS} ns
 * @param {number} maxHop - The maximum hop distance from "home".
 * @returns {string[]} Array of server hostnames.
 */
function getServersUpToLevel(ns, maxHop) {
    const visited = new Set();
    const queue = [{ server: "home", level: 0 }];
    const result = [];
    
    visited.add("home");
    while (queue.length > 0) {
        const { server, level } = queue.shift();
        if (level > 0 && level <= maxHop) {
            result.push(server);
        }
        if (level < maxHop) {
            for (const neighbor of ns.scan(server)) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push({ server: neighbor, level: level + 1 });
                }
            }
        }
    }
    return result;
}

/**
 * Checks if there are enough port openers available (from "home") to nuke the specified server.
 * For private servers (names starting with "pserv-"), this check is bypassed.
 *
 * @param {NS} ns 
 * @param {string} server - The server to check.
 * @returns {boolean} True if the server can be nuked; otherwise, false.
 */
function canNuke(ns, server) {
    // Bypass check for private servers.
    if (server.startsWith("pserv-")) {
        return true;
    }
    let portsOpened = 0;
    if (ns.fileExists("BruteSSH.exe", "home")) portsOpened++;
    if (ns.fileExists("FTPCrack.exe", "home")) portsOpened++;
    if (ns.fileExists("relaySMTP.exe", "home")) portsOpened++;
    if (ns.fileExists("HTTPWorm.exe", "home")) portsOpened++;
    if (ns.fileExists("SQLInject.exe", "home")) portsOpened++;
    const requiredPorts = ns.getServerNumPortsRequired(server);
    return (portsOpened >= requiredPorts);
}

/**
 * Attempts to gain root access to a server and executes each script from scriptsToDeploy with the appropriate thread count.
 * If a script with the same name is already running, it will be killed and restarted.
 * 
 * Now includes the hackTarget parameter, which is passed to each deployed script.
 *
 * @param {NS} ns
 * @param {string} server - The target server.
 * @param {string[]} scriptsToDeploy - The scripts to deploy.
 * @param {string} hackTarget - The target argument to pass to each script.
 */
function gainRootAccess(ns, server, scriptsToDeploy, hackTarget) {
    if (!ns.hasRootAccess(server)) {
        let portsOpened = 0;
        if (ns.fileExists("BruteSSH.exe", "home")) { ns.brutessh(server); portsOpened++; }
        if (ns.fileExists("FTPCrack.exe", "home")) { ns.ftpcrack(server); portsOpened++; }
        if (ns.fileExists("relaySMTP.exe", "home")) { ns.relaysmtp(server); portsOpened++; }
        if (ns.fileExists("HTTPWorm.exe", "home")) { ns.httpworm(server); portsOpened++; }
        if (ns.fileExists("SQLInject.exe", "home")) { ns.sqlinject(server); portsOpened++; }
        const requiredPorts = ns.getServerNumPortsRequired(server);
        if (portsOpened >= requiredPorts) {
            ns.nuke(server);
        } else {
            ns.tprint(`ERROR: Not enough ports opened to nuke ${server} (${portsOpened}/${requiredPorts}).`);
            return;
        }
    }
    if (ns.hasRootAccess(server)) {
        for (const script of scriptsToDeploy) {
            // Kill the script if it's already running
            if (ns.isRunning(script, server)) {
                ns.kill(script, server);
                ns.tprint(`Overwriting script: ${script} on ${server}.`);
            }
            // Deploy script with calculated thread count and pass the hackTarget as an argument.
            const threads = calculateThreads(ns, server, script);
            if (threads > 0) {
                ns.tprint(`Running ${script} on ${server} with ${threads} thread(s)...`);
                ns.exec(script, server, threads, hackTarget);
            } else {
                ns.tprint(`Skipping ${script} on ${server} due to insufficient RAM.`);
            }
        }
    } else {
        ns.tprint(`Failed to gain root access on ${server}.`);
    }
}

/**
 * Dynamically calculates the number of threads based on the server's available RAM and the script's RAM usage.
 * Available RAM is calculated as (maxRam - usedRam). Ensures at least 1 thread if RAM is available.
 *
 * @param {NS} ns
 * @param {string} server - The server hostname.
 * @param {string} script - The script filename.
 * @returns {number} The calculated thread count (minimum of 1 if RAM is available).
 */
function calculateThreads(ns, server, script) {
    const maxRam = ns.getServerMaxRam(server);
    const usedRam = ns.getServerUsedRam(server);
    const availableRam = maxRam - usedRam;
    const scriptRam = ns.getScriptRam(script, server);
    
    if (scriptRam <= 0) {
        ns.tprint(`Warning: Script ${script} on ${server} has 0 RAM usage, defaulting thread count to 1.`);
        return 1;
    }
    
    const threads = Math.floor(availableRam / scriptRam);
    return threads > 0 ? threads : 1;
}
