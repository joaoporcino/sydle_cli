/**
 * Generator for class.schema.js files
 * Creates Zod validation schemas for classes
 */

const fs = require('fs');
const path = require('path');
const { mapToZodSchema } = require('./utils');

/**
 * Generate class.schema.js with Zod validation
 * @param {Object} classData - Class object from Sydle API
 * @param {string} outputPath - Path to write the schema file
 */
function generateClassSchema(classData, outputPath) {
    const fields = (classData.fields || []).filter(f => !f.identifier.startsWith('_'));

    let zodContent = `const { z } = require('zod');

`;
    zodContent += `const Schema_${classData.identifier} = z.object({
`;

    fields.forEach(f => {
        zodContent += `    ${f.identifier}: ${mapToZodSchema(f)},
`;
    });

    zodContent += `});

`;
    zodContent += `module.exports = { Schema_${classData.identifier} };
`;

    const schemaPath = path.join(outputPath, 'class.schema.js');
    fs.writeFileSync(schemaPath, zodContent);
}

module.exports = {
    generateClassSchema
};
