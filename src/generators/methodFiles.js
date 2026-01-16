/**
 * Generator for method files (scripts and method.json)
 * Creates method folder structure with scripts
 */

const fs = require('fs');
const path = require('path');
const { generateJsconfig } = require('./jsconfig');
const { generateInputOutputFiles } = require('./inputOutputFiles');
const { generateMetadataFiles } = require('./metadataFiles');

/**
 * Generate method files (scripts folder, script_N.js, method.json, jsconfig.json, input/, output/)
 * @param {string} basePath - Base path for the class
 * @param {Array} methods - Array of method objects
 * @param {string} rootPath - Root path (sydle-dev)
 * @param {Map} classIdToIdentifier - Map of class IDs to identifiers
 * @param {Object} fullClassData - Full class data (optional, needed for metadata)
 */
function generateMethodFiles(basePath, methods, rootPath, classIdToIdentifier, fullClassData = null) {
    if (!methods || methods.length === 0) return;

    methods.forEach(method => {
        const methodPath = path.join(basePath, method.identifier);

        if (!fs.existsSync(methodPath)) {
            fs.mkdirSync(methodPath, { recursive: true });
        }

        if (method.scripts && method.scripts.length > 0) {
            const scriptsFolderPath = path.join(methodPath, 'scripts');
            if (!fs.existsSync(scriptsFolderPath)) {
                fs.mkdirSync(scriptsFolderPath, { recursive: true });
            }

            method.scripts.forEach((scriptContent, index) => {
                if (scriptContent) {
                    const scriptName = `script_${index}.js`;
                    const scriptPath = path.join(scriptsFolderPath, scriptName);
                    fs.writeFileSync(scriptPath, scriptContent);
                }
            });

            // Generate jsconfig.json for the scripts folder
            generateJsconfig(scriptsFolderPath, rootPath, method.identifier);

            // Generate metadata definitions if method is _getMetadata
            if (method.identifier === '_getMetadata' && fullClassData) {
                generateMetadataFiles(scriptsFolderPath, fullClassData);
            }
        }

        // Generate input/ folder if method has inputParameters
        if (method.inputParameters) {
            generateInputOutputFiles(methodPath, method.inputParameters, classIdToIdentifier, 'input');
        }

        // Generate output/ folder if method has outputParameters
        if (method.outputParameters) {
            generateInputOutputFiles(methodPath, method.outputParameters, classIdToIdentifier, 'output');
        }

        const jsonFilePath = path.join(methodPath, 'method.json');
        fs.writeFileSync(jsonFilePath, JSON.stringify(method, null, 2));
    });
}

module.exports = {
    generateMethodFiles
};
