/** 
 * This script scans servers at specific hop levels from "home" and prints detailed information.
 * 
 * Usage: run serverinfo.js [hops] [excludePrivateServers]
 * Example: run serverinfo.js 2,4 true  (scans only hops 2 and 4, excludes private servers)
 * Example: run serverinfo.js 1,3 false (scans only hops 1 and 3, includes private servers)
 * Example: run serverinfo.js 1 true/false (scans only hops 1, includes/excludes private servers)
 * 
 * @param {NS} ns 
 */
export async function main(ns) {
    // ====== CONFIGURATION ======
    const defaultHops = [1]; // Default specific hops if none provided
    const excludePrivateServers = ns.args.length > 1 ? ns.args[1] === "true" : true; // Toggle private server exclusion
    const manualExcludedServers = []; // Add any other servers you want to exclude
    // ===========================

    // Parse hops argument (comma-separated list)
    const hops = ns.args.length > 0 ? String(ns.args[0]).split(",").map(Number).filter(n => !isNaN(n) && n > 0) : defaultHops;
    if (hops.length === 0) {
        ns.tprint("ERROR: Invalid hops. Please enter a comma-separated list of positive numbers.");
        return;
    }

    // Generate excluded servers list
    let excludedServers = [...manualExcludedServers];
    if (excludePrivateServers) {
        excludedServers.push(...generatePrivateServerList());
    }

    // Get servers at specified hops
    let servers = getServersAtHops(ns, hops);
    servers = servers.filter(server => !excludedServers.includes(server)); // Remove excluded servers

    ns.tprint(`Scanning servers at hops: ${hops.join(", ")}`);
    ns.tprint(`Excluding private servers: ${excludePrivateServers}`);
    ns.tprint(`Excluded servers: ${excludedServers.length > 0 ? excludedServers.join(", ") : "None"}`);
    ns.tprint("============================================================");

    // Print server info
    for (const server of servers) {
        printServerInfo(ns, server);
        ns.tprint("------------------------------------------------------------");
        await ns.sleep(50); // Small delay for readability (optional)
    }
}

/**
 * Returns all servers at the specified hop levels from "home" using BFS.
 *
 * @param {NS} ns
 * @param {number[]} targetHops - Array of specific hop levels to scan.
 * @returns {string[]} List of server hostnames at the specified hops.
 */
function getServersAtHops(ns, targetHops) {
    const visited = new Set();
    const queue = [{ server: "home", level: 0 }];
    const result = [];

    visited.add("home");
    while (queue.length > 0) {
        const { server, level } = queue.shift();
        if (targetHops.includes(level)) {
            result.push(server);
        }
        if (Math.max(...targetHops) > level) {
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
 * Generates a list of private server names from pserv-0 to pserv-24.
 * 
 * @returns {string[]} List of private server names.
 */
function generatePrivateServerList() {
    let privateServers = [];
    for (let i = 0; i <= 24; i++) { // Change the number 24 to whatever you want. Must be positive
        privateServers.push(`pserv-${i}`);
    }
    return privateServers;
}

/**
 * Prints detailed information about a server.
 *
 * @param {NS} ns 
 * @param {string} server - Server hostname.
 */
function printServerInfo(ns, server) {
    const serverObj = ns.getServer(server);

    ns.tprint(`Server: ${server}`);
    ns.tprint(`  Root Access: ${serverObj.hasAdminRights}`);
    ns.tprint(`  Required Hacking Level: ${serverObj.requiredHackingSkill}`);
    ns.tprint(`  Security: Current ${serverObj.hackDifficulty} | Minimum ${serverObj.minDifficulty}`);
    ns.tprint(`  Money: Available ${ns.nFormat(serverObj.moneyAvailable, "$0.00a")} / Max ${ns.nFormat(serverObj.moneyMax, "$0.00a")}`);
    ns.tprint(`  RAM: ${serverObj.ramUsed} / ${serverObj.maxRam} GB`);
    ns.tprint(`  Ports Required: ${serverObj.numOpenPortsRequired}`);
    ns.tprint(`  CPU Cores: ${serverObj.cpuCores}`);
    ns.tprint(`  Hack Time: ${ns.tFormat(ns.getHackTime(server))}`);
    ns.tprint(`  Grow Time: ${ns.tFormat(ns.getGrowTime(server))}`);
    ns.tprint(`  Weaken Time: ${ns.tFormat(ns.getWeakenTime(server))}`);
    ns.tprint(`  Growth Rate: ${serverObj.serverGrowth}`);
    const chance = (ns.hackAnalyzeChance(server) * 100).toFixed(2);
    ns.tprint(`  Hack Success Chance: ${chance}%`);
}
