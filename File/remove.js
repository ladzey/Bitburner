/** 
 * This script stops and removes specific scripts from servers within a specified hop range.
 *
 * Usage: run remove.js [maxHop] [excludePrivate] [scriptsToRemove]
 *   - maxHop: The maximum hop level (distance from "home"). (Default: 1)
 *   - excludePrivate: Toggle to exclude private servers (if "true", excludes any server starting with "pserv"). (Default: false)
 *   - scriptsToRemove: A comma-separated list of script filenames to remove. (Default: "hack.js")
 *
 * Example: run remove.js 2 true "hack.js,grow.js"
 *
 * It will:
 *   1. Retrieve all servers within the specified number of hops from "home".
 *   2. Optionally exclude all private servers (any server whose name starts with "pserv").
 *   3. Skip any server specified in the manual exclusion list.
 *   4. For each remaining server, check if any file matches one of the target scripts.
 *   5. Attempt to kill the script if it's running on that server.
 *   6. Remove the file from the server.
 *
 * @param {NS} ns
 */
export async function main(ns) {
    // ====== CONFIGURATION ======
    // Default list of scripts to remove if none are provided via the terminal.
    const defaultScripts = ["hack.js"];
    // Allow the user to supply a comma-separated list of script names as the third argument.
    // Example: run remove.js 2 true "hack.js,grow.js"
    const scriptsToRemove = ns.args.length > 2 
                              ? String(ns.args[2]).split(",").map(s => s.trim()).filter(s => s.length > 0)
                              : defaultScripts;

    // Manually excluded servers (these will never be processed)
    const manualExcludedServers = [];

    // Toggle to exclude private servers is set via the second argument.
    // Convert the argument to a boolean (if provided); default is false.
    const excludePrivate = ns.args.length > 1 
                              ? String(ns.args[1]).toLowerCase() === "true" 
                              : false;
    // Build the full manual exclusion list:
    let excludedServers = [...manualExcludedServers];
    // (No need to add a fixed list here since our getServersUpToLevel() will handle private servers if toggle is true.)
    // ============================

    // Get the maximum hop level from the terminal argument (first argument). Default: 1
    const targetHop = ns.args.length > 0 ? Number(ns.args[0]) : 1;
    if (isNaN(targetHop) || targetHop <= 0) {
        ns.tprint("ERROR: Invalid hop count. Please enter a positive number.");
        return;
    }
    
    ns.tprint(`Removing scripts: ${scriptsToRemove.join(", ")}`);
    ns.tprint(`Maximum hop level: ${targetHop}`);
    ns.tprint(`Exclude private servers: ${excludePrivate}`);

    // Retrieve all servers within the target hop range.
    let servers = getServersUpToLevel(ns, targetHop, excludePrivate);
    
    // Compute the servers that are manually excluded.
    const manuallyExcluded = servers.filter(server => excludedServers.includes(server));
    // Compute candidate servers (those not manually excluded).
    servers = servers.filter(server => !excludedServers.includes(server));
    
    // Print a summary of the excluded servers.
    ns.tprint("============================================================");
    ns.tprint(`Manually excluded servers: ${manuallyExcluded.length ? manuallyExcluded.join(", ") : "None"}`);
    ns.tprint("============================================================");
    
    // Process each candidate server: attempt to remove target scripts.
    for (const server of servers) {
        ns.tprint(`Scanning ${server} for target scripts...`);
        // Get a list of all files on the server.
        const files = ns.ls(server);

        // Loop through each file and, if it matches one of the target scripts, kill and remove it.
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
 * @param {boolean} excludePrivate - Whether to exclude private servers (i.e. any server starting with "pserv").
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
            // If excludePrivate is true and the server name starts with "pserv", skip it.
            if (excludePrivate && server.startsWith("pserv")) continue;
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
