# Bitburner
Newbie Script for Bitburner

# What is it?
advancedstart.js - Copies the list of scripts (scriptsToDeploy) to all servers (excluding any specified in excludedServers).
                 - Separates servers into those that require no ports and those that do.
                 - For each server, calls gainRootAccess to open ports (if needed), nuke the server, and then execute each script from scriptsToDeploy with a calculated thread count.

remove.js - This script is designed to clean up your network by stopping and removing specific script files from every server (except those you want to keep intact).

# Disclaimer

This is my own personal repository of scripts for playing Bitburner.

* Feel free to use my scripts, copy and/or edit them.
* If you think you encountered a bug, feel free to let me know!
