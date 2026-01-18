const fs = require('fs');
const path = require('path');
const { generateJsconfig } = require('../generators/jsconfig');

/**
 * Scaffolds the method structure if it doesn't exist.
 * @param {string} methodFolder - Absolute path to the method folder
 * @param {string} rootPath - Absolute path to the root directory
 * @param {string} methodName - Name of the method to scaffold
 * @param {Object} logger - Logger instance
 * @returns {boolean} - True if scaffolding happened, false otherwise
 */
function scaffoldMethod(methodFolder, rootPath, methodName, logger) {
    const methodJsonPath = path.join(methodFolder, 'method.json');
    const scriptsFolder = path.join(methodFolder, 'scripts');
    const scriptPath = path.join(scriptsFolder, 'script_0.js');

    // If method.json and script don't exist, scaffold them
    if (!fs.existsSync(methodJsonPath) && !fs.existsSync(scriptsFolder)) {
        if (logger) logger.progress(`🆕 Detected new method folder: ${methodName}. Scaffolding...`);

        // 1. Create method.json
        const defaultMethodData = {
            identifier: methodName,
            name: methodName,
            accessLevel: 'PUBLIC',
            engine: 'GRAAL',
            inputParameters: [],
            outputParameters: [],
            scripts: []
        };
        fs.writeFileSync(methodJsonPath, JSON.stringify(defaultMethodData, null, 4));

        // 2. Create scripts folder
        fs.mkdirSync(scriptsFolder, { recursive: true });

        // 3. Create script_0.js
        fs.writeFileSync(scriptPath, `// New script for ${methodName}\n(async () => {\n    \n})();`);

        // 4. Generate jsconfig.json
        generateJsconfig(scriptsFolder, rootPath, methodName);

        // 5. Create empty types
        fs.writeFileSync(path.join(scriptsFolder, 'input.d.ts'), 'export {};\n');
        fs.writeFileSync(path.join(scriptsFolder, 'output.d.ts'), 'export {};\n');

        if (logger) logger.success(`   ✓ Scaffolding complete for ${methodName}`);
        return true;
    }
    return false;
}

module.exports = { scaffoldMethod };
