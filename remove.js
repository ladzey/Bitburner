/** 
 * This script stops and removes specific scripts from all servers, excluding those listed.
 *
 * Usage: run removeSpecificScripts.js
 *
 * It will:
 *   1. Scan every server in your network.
 *   2. Skip any server specified in the `excludedServers` array.
 *   3. For each remaining server, check if any file matches one of the specified target scripts.
 *   4. Attempt to kill the script if it's running on that server.
 *   5. Remove the file from the server.
 *
 * @param {NS} ns
 */
export async function main(ns) {
    // List of specific scripts you want to remove.
    // Modify this array to include the filenames you wish to delete.
    const scriptsToRemove = ["early-hack-template.js"];

    // List of servers to exclude from processing.
    const excludedServers = ["home"];

    // Retrieve the name of the currently running script to avoid stopping/removing it if needed.
    const currentScript = ns.getScriptName();
    
    // Get a list of all servers (including "home").
    const allServers = getAllServers(ns);
    
    // Process each server.
    for (const server of allServers) {
        // Skip any servers that are in the exclusion list.
        if (excludedServers.includes(server)) {
            ns.tprint(`Skipping excluded server: ${server}`);
            continue;
        }
        
        ns.tprint(`Scanning ${server} for target scripts...`);
        // Get a list of all files on the server.
        const files = ns.ls(server);
        
        // Loop through each file and, if it matches one of the targets, stop and remove it.
        for (const file of files) {
            // Check if this file is one of the scripts we want to remove.
            if (scriptsToRemove.includes(file)) {
                // On "home", avoid stopping or removing the currently running script.
                if (server === "home" && file === currentScript) {
                    ns.tprint(`Skipping currently running script ${file} on home.`);
                    continue;
                }
                // Attempt to stop the script on the server.
                ns.kill(file, server);
                ns.tprint(`Attempted to stop ${file} on ${server}.`);
                // Optionally, wait a short moment to allow the kill to take effect.
                await ns.sleep(100);
                // Remove the file from the server.
                ns.rm(file, server);
                ns.tprint(`Removed ${file} from ${server}.`);
            }
        }
    }
}

/**
 * Recursively scans the network starting from a given host and returns an array of all server hostnames.
 *
 * @param {NS} ns
 * @param {string} host - The host to start scanning from (defaults to "home").
 * @param {Set<string>} visited - Used internally to avoid revisiting servers.
 * @returns {string[]} An array of all server hostnames.
 */
function getAllServers(ns, host = "home", visited = new Set()) {
    visited.add(host);
    const neighbors = ns.scan(host);
    for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
            getAllServers(ns, neighbor, visited);
        }
    }
    return Array.from(visited);
}
