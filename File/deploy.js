/** 
 * @param {NS} ns 
 */
export async function main(ns) {
    // List of files (scripts) you want to deploy.
    const scriptsToDeploy = ["early-hack-template.js"];
    
    // Servers to exclude from deployment.
    const excludedServers = ["home"];

    // Specify the maximum hop/level from "home" to process.
    const targetHop = 3; // This will include servers 1 and 2 hops away.

    // Get a list of all servers up to the specified hop level.
    let servers = getServersUpToLevel(ns, targetHop);
    // Exclude any servers you don't want.
    servers = servers.filter(server => !excludedServers.includes(server));

    // Build an array of servers that we can nuke (i.e. have enough port openers).
    let validServers = [];
    for (const server of servers) {
        if (!canNuke(ns, server)) {
            ns.tprint(`Skipping server ${server} because not enough port openers are available to nuke it.`);
            continue;
        }
        validServers.push(server);
    }

    // Copy the scripts to every valid server.
    for (const server of validServers) {
        await ns.scp(scriptsToDeploy, server);
    }

    // Separate valid servers based on the number of ports required.
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

    ns.tprint(`Valid servers (up to hop ${targetHop}) requiring no ports: ${serversNoPorts}`);
    ns.tprint(`Valid servers (up to hop ${targetHop}) requiring ports: ${serversWithPorts}`);

    // Process servers that require NO ports to be opened.
    for (const server of serversNoPorts) {
        gainRootAccess(ns, server, scriptsToDeploy);
    }

    // Process servers that require ports to be opened.
    for (const server of serversWithPorts) {
        gainRootAccess(ns, server, scriptsToDeploy);
    }
}

/**
 * Returns all servers that are within the specified hop/level from "home" using a breadth-first search.
 * This function collects all servers with a level greater than 0 and less than or equal to maxHop.
 *
 * @param {NS} ns
 * @param {number} maxHop - The maximum hop level (distance) from "home".
 * @returns {string[]} An array of server hostnames within that hop range.
 */
function getServersUpToLevel(ns, maxHop) {
    const visited = new Set();
    const queue = [{ server: "home", level: 0 }];
    const result = [];
    
    visited.add("home");
    while (queue.length > 0) {
        const { server, level } = queue.shift();
        // Exclude "home" (level 0) and include only servers within our hop range.
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
 * Checks if there are enough port openers available on "home" to nuke the specified server.
 *
 * @param {NS} ns 
 * @param {string} server - The server to check.
 * @returns {boolean} True if enough port openers are available; otherwise, false.
 */
function canNuke(ns, server) {
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
 * This version first opens ports (if needed) and nukes the server.
 *
 * @param {NS} ns
 * @param {string} server
 * @param {string[]} scriptsToDeploy
 */
function gainRootAccess(ns, server, scriptsToDeploy) {
    if (!ns.hasRootAccess(server)) {
        let portsOpened = 0;

        if (ns.fileExists("BruteSSH.exe", "home")) {
            ns.brutessh(server);
            portsOpened++;
        }
        if (ns.fileExists("FTPCrack.exe", "home")) {
            ns.ftpcrack(server);
            portsOpened++;
        }
        if (ns.fileExists("relaySMTP.exe", "home")) {
            ns.relaysmtp(server);
            portsOpened++;
        }
        if (ns.fileExists("HTTPWorm.exe", "home")) {
            ns.httpworm(server);
            portsOpened++;
        }
        if (ns.fileExists("SQLInject.exe", "home")) {
            ns.sqlinject(server);
            portsOpened++;
        }

        const requiredPorts = ns.getServerNumPortsRequired(server);
        if (portsOpened >= requiredPorts) {
            ns.nuke(server);
        } else {
            ns.tprint(`ERROR: Not enough ports opened to nuke ${server} (${portsOpened}/${requiredPorts}).`);
            return; // Skip this server if we can't gain root access.
        }
    }

    if (ns.hasRootAccess(server)) {
        for (const script of scriptsToDeploy) {
            const threads = calculateThreads(ns, server, script);
            ns.tprint(`Running ${script} on ${server} with ${threads} thread(s)...`);
            ns.exec(script, server, threads);
        }
    } else {
        ns.tprint(`Failed to gain root access on ${server}.`);
    }
}

/**
 * (Optional) Opens ports on a server using available hacking tools.
 * This function is kept here if you want to separate port opening logic later.
 *
 * @param {NS} ns
 * @param {string} server
 */
function openPorts(ns, server) {
    if (ns.fileExists("BruteSSH.exe", "home")) {
        ns.brutessh(server);
    }
    if (ns.fileExists("FTPCrack.exe", "home")) {
        ns.ftpcrack(server);
    }
    if (ns.fileExists("relaySMTP.exe", "home")) {
        ns.relaysmtp(server);
    }
    if (ns.fileExists("HTTPWorm.exe", "home")) {
        ns.httpworm(server);
    }
    if (ns.fileExists("SQLInject.exe", "home")) {
        ns.sqlinject(server);
    }
}

/**
 * Calculates the number of threads to use based on the server's maximum RAM and the script's RAM usage.
 * - Below 16GB: 1 thread
 * - Exactly 16GB: 6 threads
 * - Exactly 32GB: 12 threads
 * - Otherwise: uses available RAM divided by the script's RAM usage.
 *
 * @param {NS} ns
 * @param {string} server - The server hostname.
 * @param {string} script - The script filename.
 * @returns {number} The number of threads to use.
 */
function calculateThreads(ns, server, script) {
    const maxRam = ns.getServerMaxRam(server);
    if (maxRam < 16) {
        return 1;
    } else if (maxRam === 16) {
        return 6;
    } else if (maxRam === 32) {
        return 12;
    } else {
        const scriptRam = ns.getScriptRam(script, server);
        if (scriptRam === 0) {
            ns.tprint(`Warning: Script ${script} on ${server} has 0 RAM usage, defaulting thread count to 1.`);
            return 1;
        }
        return Math.floor(maxRam / scriptRam);
    }
}
