/** 
 * This script stops and removes specific scripts from servers within a specified hop range.
 *
 * Usage: run remove.js [maxHop] [excludePrivate]
 * Example: run remove.js 2 true
 *
 * It will:
 *   1. Retrieve all servers within a specified number of hops from "home".
 *   2. Optionally exclude private servers.
 *   3. Skip any server specified in the `excludedServers` array.
 *   4. For each remaining server, check if any file matches one of the target scripts.
 *   5. Attempt to kill the script if it's running on that server.
 *   6. Remove the file from the server.
 *
 * @param {NS} ns
 */
export async function main(ns) {
    // List of specific scripts you want to remove.
    const scriptsToRemove = ["earlyhack.js"];

    // List of servers to exclude from processing.
    const excludedServers = [];

    // Get the maximum hop level (distance from "home") from the script arguments.
    // Default: 1
    const targetHop = ns.args[0] !== undefined ? ns.args[0] : 1;

    // Get the excludePrivate flag from the script arguments.
    // Default: false
    const excludePrivate = ns.args[1] !== undefined ? ns.args[1] : false;

    // Retrieve all servers within the target hop range.
    let servers = getServersUpToLevel(ns, targetHop, excludePrivate);
    
    // Exclude any servers in the excludedServers list.
    const manuallyExcluded = servers.filter(server => excludedServers.includes(server));
    servers = servers.filter(server => !excludedServers.includes(server));
    
    // Print a summary of the processed servers 
    ns.tprint("============================================================");
    ns.tprint(`Processing servers within ${targetHop} hops: ${servers}`);
    
    // Print a summary of the excluded servers.
    ns.tprint("============================================================");
    ns.tprint(`Manually excluded servers: ${manuallyExcluded.length ? manuallyExcluded.join(", ") : "None"}`);
    ns.tprint("============================================================");

    // Process each server.
    for (const server of servers) {
        ns.tprint(`Scanning ${server} for target scripts...`);
        // Get a list of all files on the server.
        const files = ns.ls(server);

        // Loop through each file and, if it matches one of the target scripts, stop and remove it.
        for (const file of files) {
            if (scriptsToRemove.includes(file)) {
                // Attempt to kill the script if it is running.
                ns.kill(file, server);
                ns.tprint(`Attempted to stop ${file} on ${server}.`);
                // Optionally wait a short moment to let the kill take effect.
                await ns.sleep(100);
                // Remove the file from the server.
                ns.rm(file, server);
                ns.tprint(`Removed ${file} from ${server}.`);
            }
        }
    }
}

/**
 * Scans the network from "home" and returns an array of all server hostnames
 * that are within the specified hop level.
 *
 * @param {NS} ns
 * @param {number} maxHop - The maximum hop level (distance from "home") to include.
 * @param {boolean} excludePrivate - Whether to exclude private servers.
 * @returns {string[]} An array of server hostnames within the specified hop range.
 */
function getServersUpToLevel(ns, maxHop, excludePrivate) {
    const visited = new Set();
    const queue = [{ server: "home", level: 0 }];
    const result = [];

    visited.add("home");
    while (queue.length > 0) {
        const { server, level } = queue.shift();
        // Only add servers that are at least 1 hop away and within maxHop.
        if (level > 0 && level <= maxHop) {
            if (excludePrivate && server.startsWith("pserv")) continue;
            result.push(server);
        }
        // Continue the search if we haven't reached the maximum hop level.
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
