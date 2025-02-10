# Bitburner
Newbie Script for Bitburner

# What is it?
deploy.js - This script allows you to copy and run specified scripts in all the servers if the server already has the same name scripts it will overwrite the scripts. 
It will even print out some information. 
(You can configure the settings to your liking. Like what scripts you want to deploy, manually exclude servers, toggle excluding private servers, and set maximum "hops").

remove.js - This script allows you to stop and remove specified scripts in all the servers. 
It will print out some information. 
(You can configure the settings to your liking. Like what scripts you want to remove, manually exclude servers, toggle excluding private servers, and set maximum "hops").

serverinfo.js - This script scans servers at specific "hop" levels from "home" and prints detailed information. (Specific means only 1 "hop" will be scanned, but you can insert 2 or more "hops")

# Usage
run deploy.js [maxHop] [excludePrivate] [scriptname]

run remove.js [maxHop] [excludePrivate] [scriptname]

run serverinfo.js [hops] [targetServer]

# Exclusive Example
run deploy.js 1 false hack.js

run deploy.js 1 false hack.js,grow.js

run remove.js 1 false hack.js

run remove.js 1 false hack.js,grow.js

run serverinfo.js 1 n00dles

run serverinfo.js 2,4

# Disclaimer

This is my own personal repository of scripts for playing Bitburner.

* Feel free to use my scripts, copy and/or edit them.
* If you think you encountered a bug, feel free to let me know!
