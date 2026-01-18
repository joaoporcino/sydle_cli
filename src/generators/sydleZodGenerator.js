/**
 * Generator for sydleZod.js
 * Copies the schema builder to the project's typings folder
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate sydleZod.js in the typings folder
 * @param {string} rootPath - Root project path (e.g., sydle-dev)
 */
function generateSydleZod(rootPath) {
    const typingsPath = path.join(path.dirname(rootPath), 'typings');

    if (!fs.existsSync(typingsPath)) {
        fs.mkdirSync(typingsPath, { recursive: true });
    }

    const targetPath = path.join(typingsPath, 'sydleZod.js');

    // Read the source file from the CLI installation
    const sourcePath = path.join(__dirname, '..', 'utils', 'sydleZod.js');

    if (fs.existsSync(sourcePath)) {
        const content = fs.readFileSync(sourcePath, 'utf8');
        fs.writeFileSync(targetPath, content);
        console.log(`Generated sydleZod.js in ${typingsPath}`);
    } else {
        console.warn(`Warning: sydleZod.js source not found at ${sourcePath}`);
    }
}

module.exports = {
    generateSydleZod
};
