// The utility process provides bundled Node.js; users do not install Node.
const path = require("node:path");
require(path.join(process.env.CLARITY_RUNTIME_DIR, "server.js"));
