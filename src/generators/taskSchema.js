/**
 * Generator for task schema files
 * Creates schema.js files for task validation
 */

const fs = require('fs');
const path = require('path');

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
 * Converts a task folder name to a schema variable name
 * @param {string} taskName - Task folder name (e.g., "aprovar_solicitacao")
 * @returns {string} Schema variable name (e.g., "aprovarSolicitacaoSchema")
 */
function taskNameToSchemaName(taskName) {
    const parts = taskName.split('_');
    return parts[0] + parts.slice(1).map(part => capitalize(part)).join('') + 'Schema';
}

/**
 * Generate schema.js file for a task
 * @param {string} taskPath - Path to the task folder
 * @param {Object} taskSettings - Task settings object
 */
function generateTaskSchema(taskPath, taskSettings) {
    const taskFolderName = path.basename(taskPath);
    const schemaName = taskNameToSchemaName(taskFolderName);
    const taskDisplayName = taskSettings._name || taskFolderName;

    let schemaContent = `const { sy } = require('../../../../typings/sydleZod');\n\n`;
    schemaContent += `/**\n * Schema for task: ${taskDisplayName}\n */\n`;
    schemaContent += `const ${schemaName} = {\n`;
    schemaContent += `  // TODO: Implement schema validation\n`;
    schemaContent += `};\n\n`;
    schemaContent += `module.exports = {\n`;
    schemaContent += `  ${schemaName}\n`;
    schemaContent += `};\n`;

    fs.writeFileSync(path.join(taskPath, 'task.schema.js'), schemaContent);
}

module.exports = {
    generateTaskSchema
};
