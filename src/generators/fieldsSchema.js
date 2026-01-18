/**
 * Generator for fields.js files
 * Creates Sydle Schema files from class.json fields using sy.section().name().type() syntax
 */

const fs = require('fs');
const path = require('path');

/**
 * Map a Sydle field to sy builder chain
 * @param {Object} field - Field object from class.json
 * @returns {string} sy chain code
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
 * Generate fields.js with sy schema syntax
 * @param {Object} classData - Class object from Sydle API
 * @param {string} outputPath - Path to write the fields.js file
 * @param {string} [rootPath] - Root project path to calculate relative import
 */
function generateFieldsSchema(classData, outputPath, rootPath) {
    // Filter out system fields (starting with _)
    const fields = (classData.fields || []).filter(f => !f.identifier.startsWith('_'));

    if (fields.length === 0) {
        console.log(`Skipping fields.js for ${classData.identifier} - no custom fields`);
        return;
    }

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
 * Auto-generated from class.json
 * @see class.json
 */

const { sy } = require('${sydleZodPath}');

module.exports = {
`;

    fields.forEach((field, index) => {
        const comma = index < fields.length - 1 ? ',' : '';
        content += `    ${field.identifier}: ${mapFieldToSy(field)}${comma}\n`;
    });

    content += `};
`;

    const fieldsPath = path.join(outputPath, 'fields.js');
    fs.writeFileSync(fieldsPath, content);
    console.log(`Generated fields.js for ${classData.identifier}`);
}

module.exports = {
    generateFieldsSchema,
    mapFieldToSy
};
