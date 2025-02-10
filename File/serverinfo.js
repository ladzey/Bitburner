/** 
 * This script scans servers at specific hop levels from "home" and prints detailed information.
 * When scanning for a specific server (by providing it as the second argument), the script
 * also prints the node path from "home" to that server after printing the excluded servers summary.
 * 
 * Usage: run serverinfo.js [hops] [targetServer]
 * 
 * Examples:
 *   run serverinfo.js 2,4         (scans only hops 2 and 4 using the internal private server exclusion setting)
 *   run serverinfo.js 1, myserver  (scans only hop 1 and then prints info for the specific server "myserver",
 *                                  along with its node path)
 * 
 * @param {NS} ns 
 */
export async function main(ns) {
    // ====== CONFIGURATION ======
    const defaultHops = [1];              // Default specific hops if none provided
    const excludePrivateServers = true;   // Toggle private server exclusion (set inside the script)
    const manualExcludedServers = [];     // Add any other servers you want to exclude
    // ============================

    // Parse hops argument (comma-separated list)
    const hops = ns.args.length > 0 
                   ? String(ns.args[0]).split(",").map(Number).filter(n => !isNaN(n) && n > 0) 
                   : defaultHops;
    if (hops.length === 0) {
        ns.tprint("ERROR: Invalid hops. Please enter a comma-separated list of positive numbers.");
        return;
    }

    // Optional: if provided as the second argument, scan this specific server.
    const targetServer = ns.args.length > 1 ? String(ns.args[1]).trim() : "";

    // Generate the list of excluded servers.
    let excludedServers = [...manualExcludedServers];
    if (excludePrivateServers) {
        excludedServers.push(...generatePrivateServerList());
    }

    // Build the list of servers to process.
    let servers = [];
    if (targetServer !== "") {
        ns.tprint(`Scanning specific server: ${targetServer}`);
        servers.push(targetServer);
    } else {
        ns.tprint(`Scanning servers at hops: ${hops.join(", ")}`);
        servers = getServersAtHops(ns, hops);
    }

    // Remove excluded servers (if scanning by hops).
    if (targetServer === "") {
        servers = servers.filter(server => !excludedServers.includes(server));
    }

    ns.tprint(`Excluding private servers: ${excludePrivateServers}`);
    ns.tprint(`Excluded servers: ${excludedServers.length > 0 ? excludedServers.join(", ") : "None"}`);
    ns.tprint("============================================================");

    // If scanning a specific server, now print its node path from "home"
    if (targetServer !== "") {
        const nodePath = getPathToServer(ns, targetServer);
        if (nodePath.length > 0) {
            ns.tprint(`Node Path: ${nodePath.join(" -> ")}`);
        } else {
            ns.tprint(`Node Path not found for ${targetServer}.`);
        }
        ns.tprint("============================================================");
    }

    // Print server info for each server in the final list
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
    for (let i = 0; i <= 24; i++) {
        privateServers.push(`pserv-${i}`);
    }
    return privateServers;
}

/**
 * Returns the node path (as an array of server names) from "home" to the target server using BFS.
 * 
 * @param {NS} ns
 * @param {string} target - The target server name.
 * @returns {string[]} The node path from "home" to target, or an empty array if not found.
 */
function getPathToServer(ns, target) {
    const visited = new Set();
    const queue = [{ server: "home", path: ["home"] }];
    visited.add("home");

    while (queue.length > 0) {
        const { server, path } = queue.shift();
        if (server === target) {
            return path;
        }
        for (const neighbor of ns.scan(server)) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push({ server: neighbor, path: [...path, neighbor] });
            }
        }
    }
    return [];
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
