/**
 * Generator for input folder files (input.d.ts and input.schema.js)
 * Creates input parameter type definitions and schemas
 */

const fs = require('fs');
const path = require('path');
const { mapToTsType } = require('./utils');
const { generateClassSchema } = require('./classSchema');

/**
 * Generate input folder with input.d.ts and input.schema.js
 * @param {string} methodPath - Path to method directory
 * @param {Object} inputParameters - Input parameters object with fields
 * @param {Object} classIdToIdentifier - Map of class IDs to identifiers
 */
function generateInputFiles(methodPath, inputParameters, classIdToIdentifier) {
    if (!inputParameters) {
        return;
    }

    // Create input folder
    const inputPath = path.join(methodPath, 'input');
    if (!fs.existsSync(inputPath)) {
        fs.mkdirSync(inputPath, { recursive: true });
    }

    // Write inputParameters.json in the root of input folder
    const inputParamsJsonPath = path.join(inputPath, 'inputParameters.json');
    fs.writeFileSync(inputParamsJsonPath, JSON.stringify(inputParameters, null, 2));

    const fields = inputParameters.fields ? inputParameters.fields.filter(f => !f.identifier.startsWith('_')) : [];

    if (fields.length === 0 && (!inputParameters.methods || inputParameters.methods.length === 0)) {
        return; // Only private fields or no fields/methods, skip
    }

    // Generate input.d.ts
    if (fields.length > 0) {
        let inputDtsContent = `/**
 * Input parameter types
 */

declare interface I_Input {
`;

        fields.forEach(f => {
            inputDtsContent += `    ${f.identifier}${f.required ? '' : '?'}: ${mapToTsType(f, classIdToIdentifier)};
`;
        });

        inputDtsContent += `}

declare var _input: I_Input;
`;

        fs.writeFileSync(path.join(inputPath, 'input.d.ts'), inputDtsContent);

        // Generate input.schema.js using the shared generateClassSchema
        // Create a mock class object with identifier 'Input' for consistent naming
        const mockInputClass = {
            identifier: 'Input',
            fields: inputParameters.fields
        };
        generateClassSchema(mockInputClass, inputPath);
    }

    // Generate method folders with scripts if inputParameters has methods
    // Reuse the generateMethodFiles function to avoid code duplication
    if (inputParameters.methods && inputParameters.methods.length > 0) {
        // generateMethodFiles expects: (basePath, methods, rootPath, classIdToIdentifier)
        // We need to get rootPath from the methodPath
        const rootPath = path.join(methodPath, '..', '..', '..');

        // Call generateMethodFiles with the input folder as basePath
        const { generateMethodFiles } = require('./methodFiles');
        generateMethodFiles(inputPath, inputParameters.methods, rootPath, classIdToIdentifier);
    }
}

module.exports = {
    generateInputFiles
};
