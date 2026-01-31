/**
 * @fileoverview Generator for fields.js schema files
 * 
 * This module generates `fields.js` files for each Sydle class,
 * converting the raw field definitions from `class.json` into
 * a fluent API syntax using the `sy` schema builder.
 * 
 * @module generators/fieldsSchema
 * @requires fs
 * @requires path
 * 
 * @example
 * // Usage in processClasses.js
 * const { generateFieldsSchema } = require('./fieldsSchema');
 * generateFieldsSchema(classData, classDir, rootPath);
 * 
 * @example
 * // Generated output example (fields.js):
 * const { sy } = require('../../../typings/sydleZod');
 * module.exports = {
 *     nome: sy.section('Campos').name('Nome').type('STRING').required().searchable(),
 *     idade: sy.section('Dados').name('Idade').type('INTEGER').relevancy('COMMON')
 * };
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

/**
 * Maps a Sydle field definition to an `sy` builder chain string.
 * 
 * Converts a raw field object from `class.json` into the fluent API syntax
 * used by the `sydleZod` schema builder. Handles all field properties including:
 * - Basic properties: section, name, type, identifier
 * - Boolean flags: required, readOnly, hidden, searchable, multiple, unique, etc.
 * - Reference configurations: refClass, embedded
 * - Calculated fields: valueExpression, engine, calculationStrategy
 * - Exhibition settings: size, breakLine
 * 
 * @param {Object} field - Field object from class.json
 * @param {string} field.identifier - Unique field identifier (e.g., 'nome', 'idade')
 * @param {string} field.name - Display name of the field
 * @param {string} field.type - Field type ('STRING', 'INTEGER', 'REFERENCE', etc.)
 * @param {string} [field.section='Campos'] - Section where the field belongs
 * @param {boolean} [field.required] - Whether the field is required
 * @param {boolean} [field.readOnly] - Whether the field is read-only
 * @param {boolean} [field.searchable] - Whether the field is searchable
 * @param {boolean} [field.hidden] - Whether the field is hidden
 * @param {boolean} [field.multiple] - Whether the field accepts multiple values
 * @param {boolean} [field.unique] - Whether the field value must be unique
 * @param {boolean} [field.i18n] - Whether the field supports internationalization
 * @param {boolean} [field.encrypted] - Whether the field value is encrypted
 * @param {boolean} [field.embedded] - Whether the field is embedded
 * @param {boolean} [field.shiftable] - Whether the field value can be shifted
 * @param {boolean} [field.displayOnEditMode] - Whether to display on edit mode
 * @param {boolean} [field.calculated] - Whether the field is calculated
 * @param {string} [field.engine] - Calculation engine
 * @param {string} [field.valueExpression] - Calculation expression
 * @param {string} [field.relevancy] - Field relevancy
 * @param {number} [field.minMultiplicity] - Minimum multiplicity
 * @param {number} [field.maxMultiplicity] - Maximum multiplicity
 * @param {any} [field.defaultValue] - Default value
 * @param {Array<any>} [field.valueOptions] - Value options
 * @param {string} [field.editHelp] - Helper text for editing
 * @param {string} [field.calculationStrategy] - Strategy for calculation
 * @param {Object} [field.refClass] - Reference class info for REFERENCE types
 * @param {Object} [field.exhibitionConfigs] - UI display configurations
 * @returns {string} The `sy` builder chain code as a string
 * 
 * @example
 * // Input field object
 * const field = {
 *     identifier: 'nome',
 *     name: 'Nome',
 *     type: 'STRING',
 *     section: 'Dados Pessoais',
 *     required: true,
 *     searchable: true,
 *     exhibitionConfigs: { size: 'md' }
 * };
 * 
 * // Output
 * mapFieldToSy(field);
 * // Returns: "sy.section('Dados Pessoais').name('Nome').type('STRING').required().searchable().size('md')"
 */
function mapFieldToSy(field) {
    const chains = [];

    // Section (use section if provided, else default to 'Campos')
    const section = field.section || 'Campos';
    chains.push(`sy.section('${section}')`);

    // Name (required)
    chains.push(`.name('${field.name}')`);

    // Type (required)
    chains.push(`.type('${field.type}')`);

    // RefClass for REFERENCE types
    if (field.type === 'REFERENCE' && field.refClass) {
        const refId = field.refClass.identifier || field.refClass._id;
        if (refId) {
            chains.push(`.refClass('${refId}')`);
        }
    }

    // Boolean flags
    if (field.required) chains.push(`.required()`);
    if (field.readOnly) chains.push(`.readOnly()`);
    if (field.hidden) chains.push(`.hidden()`);
    if (field.searchable) chains.push(`.searchable()`);
    if (field.multiple) chains.push(`.multiple()`);
    if (field.unique) chains.push(`.unique()`);
    if (field.i18n) chains.push(`.i18n()`);
    if (field.encrypted) chains.push(`.encrypted()`);
    if (field.embedded) chains.push(`.embedded()`);
    if (field.shiftable) chains.push(`.shiftable()`);
    if (field.displayOnEditMode) chains.push(`.displayOnEditMode()`);
    if (field.calculated) {
        const engine = field.engine || 'GRAAL';
        const expr = (field.valueExpression || '').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        chains.push(`.calculated('${expr}', '${engine}')`);
    }

    // Non-boolean fields
    if (field.relevancy) chains.push(`.relevancy('${field.relevancy}')`);
    if (field.minMultiplicity !== null && field.minMultiplicity !== undefined) {
        chains.push(`.minMultiplicity(${field.minMultiplicity})`);
    }
    if (field.maxMultiplicity !== null && field.maxMultiplicity !== undefined) {
        chains.push(`.maxMultiplicity(${field.maxMultiplicity})`);
    }
    if (field.defaultValue !== null && field.defaultValue !== undefined) {
        const val = typeof field.defaultValue === 'string'
            ? `'${field.defaultValue}'`
            : JSON.stringify(field.defaultValue);
        chains.push(`.defaultValue(${val})`);
    }
    if (field.valueOptions && field.valueOptions.length > 0) {
        const opts = field.valueOptions.map(o => {
            if (typeof o === 'string') return `'${o}'`;
            return `'${o.value || o.identifier}'`;
        });
        chains.push(`.valueOptions([${opts.join(', ')}])`);
    }
    if (field.editHelp) {
        chains.push(`.editHelp('${field.editHelp.replace(/'/g, "\\'")}')`);
    }
    if (field.calculationStrategy) {
        chains.push(`.calculationStrategy('${field.calculationStrategy}')`);
    }

    // Exhibition configs
    if (field.exhibitionConfigs) {
        const ec = field.exhibitionConfigs;
        if (ec.size) chains.push(`.size('${ec.size}')`);
        if (ec.breakLine === true) chains.push(`.breakLine()`);
        if (ec.breakLine === false) chains.push(`.breakLine(false)`);
    }

    return chains.join('');
}

/**
 * Generates a `fields.js` file with the `sy` schema syntax.
 * 
 * Creates a JavaScript file that exports a schema object using the fluent API
 * provided by `sydleZod`. The generated file can be used for field validation,
 * documentation, and IDE IntelliSense support.
 * 
 * System fields (identifiers starting with `_`) are automatically filtered out.
 * If a class has no custom fields, the file generation is skipped.
 * 
 * @param {Object} classData - Class object from Sydle API
 * @param {string} classData.identifier - Unique class identifier
 * @param {string} [classData.name] - Display name of the class
 * @param {Array<Object>} [classData.fields] - Array of field definitions
 * @param {string} outputPath - Directory path to write the `fields.js` file
 * @param {string} [rootPath] - Root project path to calculate relative import path
 * 
 * @example
 * // Generate fields.js for a class
 * const classData = {
 *     identifier: 'Funcionario',
 *     name: 'Funcionário',
 *     fields: [
 *         { identifier: 'nome', name: 'Nome', type: 'STRING', required: true },
 *         { identifier: '_id', name: 'ID', type: 'ID' } // Will be filtered out
 *     ]
 * };
 * generateFieldsSchema(classData, 'C:/project/sydle-dev/rh/Funcionario', 'C:/project');
 * // Creates: C:/project/sydle-dev/rh/Funcionario/fields.js
 * 
 * @returns {void}
 */
function generateFieldsSchema(classData, outputPath, rootPath) {
    // Filter out system fields (starting with _)
    const fields = (classData.fields || []).filter(f => !f.identifier.startsWith('_'));

    // Calculate relative path from class directory to typings folder
    // Structure: rootPath/sydle-dev/package/Class/ -> rootPath/typings/sydleZod
    let sydleZodPath = '../../../typings/sydleZod'; // Default: 3 levels up
    if (rootPath) {
        const typingsPath = path.join(path.dirname(rootPath), 'typings', 'sydleZod');
        const relativePath = path.relative(outputPath, typingsPath).replace(/\\/g, '/');
        sydleZodPath = relativePath;
    }

    let content = `/**
 * Sydle Schema - ${classData.name || classData.identifier}
 * Auto-generated from the schema definition file.
 * Reference: class.json or task.json
 */

const { sy } = require('${sydleZodPath}');

module.exports = {
`;

    if (fields.length === 0) {
        // Generate empty template with commented example
        content += `    // Example field - uncomment and customize as needed:
    // fieldName: sy.section('Section').name('Field Name').type('STRING').required(),
`;
    } else {
        // Generate actual fields
        fields.forEach((field, index) => {
            const comma = index < fields.length - 1 ? ',' : '';
            content += `    ${field.identifier}: ${mapFieldToSy(field)}${comma}\n`;
        });
    }

    content += `};
`;

    const fieldsPath = path.join(outputPath, 'fields.js');
    fs.writeFileSync(fieldsPath, content);

    if (fields.length === 0) {
        logger.debug(`Generated empty fields.js template for ${classData.identifier}`);
    } else {
        logger.debug(`Generated fields.js for ${classData.identifier} with ${fields.length} fields`);
    }
}

module.exports = {
    generateFieldsSchema,
    mapFieldToSy
};
