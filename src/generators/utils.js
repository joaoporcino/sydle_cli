/**
 * Utility functions for code generation
 * Shared by all generators
 */

const path = require('path');
const { logger } = require('../utils/logger');

/**
 * Map Sydle field type to TypeScript type
 * @param {Object} field - Field object from Sydle API
 * @param {Map} classIdToIdentifier - Map of class IDs to identifiers
 * @returns {string} TypeScript type
 */
function mapToTsType(field, classIdToIdentifier) {
    let type = 'any';
    const baseType = field.type;

    // For REFERENCE fields, use the referenced class interface
    if (baseType === 'REFERENCE' && field.refClass && field.refClass._id) {
        const refClassName = classIdToIdentifier.get(field.refClass._id);
        if (refClassName) {
            type = `I_Data_${refClassName}`;
        } else {
            logger.warn(`Warning: Referenced class ${field.refClass._id} not found for field ${field.identifier}`);
            type = 'string';
        }
    }
    else if (['STRING', 'ID', 'DATE', 'FILE'].includes(baseType)) type = 'string';
    else if (baseType === 'BOOLEAN') type = 'boolean';
    else if (['INTEGER', 'DECIMAL'].includes(baseType)) type = 'number';

    return field.multiple ? `${type}[]` : type;
}

/**
 * Map Sydle field type to Zod schema
 * @param {Object} field - Field object from Sydle API
 * @returns {string} Zod schema string
 */
function mapToZodSchema(field) {
    let schema = 'z.any()';
    const baseType = field.type;

    if (['STRING', 'ID', 'DATE'].includes(baseType)) {
        schema = 'z.string()';
        if (field.additionalConfigs && field.additionalConfigs.maxLength) {
            schema += `.max(${field.additionalConfigs.maxLength})`;
        }
    } else if (baseType === 'REFERENCE') {
        schema = 'z.object({ _id: z.string(), _classId: z.string() })';
    } else if (baseType === 'BOOLEAN') {
        schema = 'z.boolean()';
    } else if (['INTEGER', 'DECIMAL'].includes(baseType)) {
        schema = 'z.number()';
    } else if (baseType === 'FILE') {
        schema = 'z.any()';
    }

    if (field.multiple) schema = `z.array(${schema})`;
    if (!field.required) schema += '.optional().nullable()';

    return schema;
}

/**
 * Calculate relative path from one directory to another
 * @param {string} from - Source directory
 * @param {string} to - Target directory
 * @returns {string} Relative path
 */
function getRelativePath(from, to) {
    const relative = path.relative(from, to);
    // Convert Windows paths to forward slashes for consistency
    return relative.replace(/\\/g, '/');
}

module.exports = {
    mapToTsType,
    mapToZodSchema,
    getRelativePath
};
