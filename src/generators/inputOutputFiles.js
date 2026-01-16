/**
 * Generator for input/output folder files (input.d.ts/output.d.ts and schemas)
 * Creates parameter type definitions and schemas
 */

const fs = require('fs');
const path = require('path');
const { mapToTsType } = require('./utils');
const { generateClassSchema } = require('./classSchema');

/**
 * Generate input or output folder with d.ts and schema.js
 * @param {string} methodPath - Path to method directory
 * @param {Object} parameters - Input or Output parameters object with fields
 * @param {Object} classIdToIdentifier - Map of class IDs to identifiers
 * @param {string} type - 'input' or 'output'
 */
function generateInputOutputFiles(methodPath, parameters, classIdToIdentifier, type = 'input') {
    if (!parameters) {
        return;
    }

    // Create folder (input or output)
    const folderPath = path.join(methodPath, type);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }

    // Write parameters json in the root of folder
    const paramsJsonPath = path.join(folderPath, `${type}Parameters.json`);
    fs.writeFileSync(paramsJsonPath, JSON.stringify(parameters, null, 2));

    const fields = parameters.fields ? parameters.fields.filter(f => !f.identifier.startsWith('_')) : [];

    if (fields.length === 0 && (!parameters.methods || parameters.methods.length === 0)) {
        return; // Only private fields or no fields/methods, skip
    }

    const typeCapitalized = type.charAt(0).toUpperCase() + type.slice(1);

    // Generate .d.ts
    if (fields.length > 0) {
        let dtsContent = `/**
 * ${typeCapitalized} parameter types
 */

declare interface I_${typeCapitalized} {
`;

        fields.forEach(f => {
            dtsContent += `    ${f.identifier}${f.required ? '' : '?'}: ${mapToTsType(f, classIdToIdentifier)};
`;
        });

        dtsContent += `}

declare var _${type}: I_${typeCapitalized};
`;

        fs.writeFileSync(path.join(folderPath, `${type}.d.ts`), dtsContent);

        // Generate schema.js using the shared generateClassSchema
        // Create a mock class object with identifier 'Input' or 'Output' for consistent naming
        const mockClass = {
            identifier: typeCapitalized,
            fields: parameters.fields
        };
        generateClassSchema(mockClass, folderPath);
    }

    // Generate method folders with scripts if parameters has methods
    // Reuse the generateMethodFiles function to avoid code duplication
    if (parameters.methods && parameters.methods.length > 0) {
        // generateMethodFiles expects: (basePath, methods, rootPath, classIdToIdentifier)
        // We need to get rootPath from the methodPath
        const rootPath = path.join(methodPath, '..', '..', '..');

        // Call generateMethodFiles with the folder as basePath
        const { generateMethodFiles } = require('./methodFiles');
        generateMethodFiles(folderPath, parameters.methods, rootPath, classIdToIdentifier, null); // Nested methods likely don't need class metadata for now, or we'd need to pass it down
    }
}

module.exports = {
    generateInputOutputFiles
};
