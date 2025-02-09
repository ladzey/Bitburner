/** 
 * @param {NS} ns 
 */
export async function main(ns) {
    // List of files (scripts) you want to deploy.
    const scriptsToDeploy = ["early-hack-template.js"];

    // Servers to exclude from deployment.
    const excludedServers = ["home"];

    // Get a list of all servers and exclude the specified ones.
    let allServers = getAllServers(ns).filter(server => !excludedServers.includes(server));

    // Copy the scripts to every valid server.
    for (const server of allServers) {
        await ns.scp(scriptsToDeploy, server);
    }

    // Separate servers based on the number of ports required.
    const serversNoPorts = [];
    const serversWithPorts = [];
    for (const server of allServers) {
        const portsRequired = ns.getServerNumPortsRequired(server);
        if (portsRequired === 0) {
            serversNoPorts.push(server);
        } else {
            serversWithPorts.push(server);
        }
    }

    ns.tprint(`Servers requiring no ports: ${serversNoPorts}`);
    ns.tprint(`Servers requiring ports: ${serversWithPorts}`);

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
 * Recursively scans your network and returns an array of all server hostnames.
 * @param {NS} ns 
 * @param {string} host - The current host to scan from (defaults to "home").
 * @param {Set<string>} visited - A Set to track visited servers.
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

/**
 * Attempts to gain root access to a server and executes each script from scriptsToDeploy with the appropriate thread count.
 * This updated version first checks if you have enough port openers before calling ns.nuke().
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
 * Opens ports on a server using available hacking tools.
 * @param {NS} ns
 * @param {string} server
 */
function openPorts(ns, server) {
    // This function is now incorporated into gainRootAccess.
    // It is kept here if you want to separate port opening logic later.
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
