/**
 * Generator for jsconfig.json files
 * Creates TypeScript configuration for script folders
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate jsconfig.json in a script folder
 * @param {string} scriptFolderPath - Absolute path to scripts folder
 * @param {string} rootPath - Absolute path to root directory (sydle-dev)
 */
function generateJsconfig(scriptFolderPath, rootPath, methodIdentifier) {
    // Calculate relative path from script folder to root
    const scriptPathParts = scriptFolderPath.split(path.sep);
    const rootPathParts = rootPath.split(path.sep);
    const relativeDepth = scriptPathParts.length - rootPathParts.length;
    const relativePath = '../'.repeat(relativeDepth);

    // Create method.d.ts
    const globalsContent = `// Auto-generated globals for method ${methodIdentifier}\ndeclare var _input: I_Input_${methodIdentifier};`;
    fs.writeFileSync(path.join(scriptFolderPath, 'method.d.ts'), globalsContent);

    const jsconfigContent = {
        "compilerOptions": {
            "checkJs": true,
            "allowJs": true,
            "noEmit": true
        },
        "include": [
            "*.js",
            "./method.d.ts",
            "../../class.d.ts",
            `${relativePath}globals.d.ts`
        ]
    };

    if (methodIdentifier === '_getMetadata') {
        jsconfigContent.include.push('./metadata.d.ts');
    }

    const jsconfigPath = path.join(scriptFolderPath, 'jsconfig.json');
    fs.writeFileSync(jsconfigPath, JSON.stringify(jsconfigContent, null, 2));
}

module.exports = {
    generateJsconfig
};
