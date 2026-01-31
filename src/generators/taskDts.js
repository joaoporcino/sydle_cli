/**
 * Generator for task TypeScript definition files
 * Creates .d.ts files with field type definitions for tasks
 */

const fs = require('fs');
const path = require('path');
const { mapToTsType } = require('./utils');

/**
 * Capitalizes first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts a task folder name to a TypeScript interface name
 * @param {string} taskName - Task folder name (e.g., "aprovar_solicitacao")
 * @returns {string} Interface name (e.g., "AprovarSolicitacao")
 */
function taskNameToInterfaceName(taskName) {
    return taskName
        .split('_')
        .map(part => capitalize(part))
        .join('');
}

/**
 * Generate TypeScript .d.ts file for a task
 * @param {string} fieldsPath - Path to the fields folder
 * @param {Object} taskSettings - Task settings object with fields
 * @param {Map} classIdToIdentifier - Map of class IDs to identifiers
 * @param {string} taskFolderName - Task folder name for interface naming
 */
function generateTaskDts(fieldsPath, taskSettings, classIdToIdentifier, taskFolderName) {
    const interfaceName = taskNameToInterfaceName(taskFolderName);
    const taskDisplayName = taskSettings._name || taskFolderName;
    const fields = taskSettings.fields || [];

    let dtsContent = `/**\n * Task: ${taskDisplayName}\n`;
    if (taskSettings.documentation) {
        dtsContent += ` * ${taskSettings.documentation}\n`;
    }
    dtsContent += ` */\n`;
    dtsContent += `declare interface ${interfaceName} {\n`;

    if (fields.length === 0) {
        dtsContent += `  // No fields defined\n`;
    } else {
        fields.forEach(field => {
            const tsType = mapToTsType(field, classIdToIdentifier);
            const optional = field.required ? '' : '?';
            const comment = field.documentation ? ` // ${field.documentation}` : '';
            dtsContent += `  ${field.identifier}${optional}: ${tsType};${comment}\n`;
        });
    }

    dtsContent += `}\n`;

    fs.writeFileSync(path.join(fieldsPath, 'task.d.ts'), dtsContent);
}

module.exports = {
    generateTaskDts
};
