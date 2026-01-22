/**
 * Generator for subprocess files from diagram subprocesses array
 * Creates subprocess folder structure with methods
 */

const fs = require('fs');
const path = require('path');
const { generateMethodFiles } = require('./methodFiles');
const { generateFieldsSchema } = require('./fieldsSchema');
const { generateTaskDts } = require('./taskDts'); // Reuse for subprocesses
const { generateTaskSchema } = require('./taskSchema'); // Reuse for subprocesses
const { logger } = require('../utils/logger');

/**
 * Sanitizes a name to be used as a folder name
 * @param {string|Object} name - Name to sanitize
 * @returns {string} Sanitized name
 */
function sanitizeFolderName(name) {
    if (typeof name === 'object' && name !== null) {
        name = name.pt || name.en || Object.values(name)[0];
    }
    if (!name || typeof name !== 'string') return '';

    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^a-z0-9_-]/g, '_')    // Replace invalid chars
        .replace(/_+/g, '_')              // Collapse multiple underscores
        .replace(/^_|_$/g, '');           // Trim underscores
}

/**
 * Generate subprocess files from diagram subprocesses array
 * @param {string} diagramPath - Path to the diagram folder
 * @param {Array} subprocesses - Array of subprocess objects from diagram
 * @param {string} rootPath - Root path (sydle-process-[env])
 * @param {Map} classIdToIdentifier - Map of class IDs to identifiers
 */
function generateSubprocessFiles(diagramPath, subprocesses, rootPath, classIdToIdentifier) {
    if (!subprocesses || subprocesses.length === 0) {
        return;
    }

    const subprocessesPath = path.join(diagramPath, 'subprocesses');

    if (!fs.existsSync(subprocessesPath)) {
        fs.mkdirSync(subprocessesPath, { recursive: true });
    }

    subprocesses.forEach(subprocess => {
        // Use sanitized name as folder name, fallback to identifier
        const subprocessFolderName = subprocess.name ? sanitizeFolderName(subprocess.name) : (subprocess.identifier || subprocess._id);
        const subprocessPath = path.join(subprocessesPath, subprocessFolderName);

        if (!fs.existsSync(subprocessPath)) {
            fs.mkdirSync(subprocessPath, { recursive: true });
        }

        // Save subprocess.json (complete subprocess data)
        fs.writeFileSync(
            path.join(subprocessPath, 'subprocess.json'),
            JSON.stringify(subprocess, null, 2)
        );

        // Generate fields, schema, and typings if subprocess has fields
        if (subprocess.settings?.fields && subprocess.settings.fields.length > 0) {
            try {
                // Create a class-like object for generateFieldsSchema
                const subprocessAsClass = {
                    identifier: subprocessFolderName,
                    name: subprocess.settings._name || subprocess.name || subprocessFolderName,
                    fields: subprocess.settings.fields
                };

                // Generate fields.js using SydleZod (correct parameter order: classData, outputPath, rootPath)
                generateFieldsSchema(subprocessAsClass, subprocessPath, rootPath);

                // Generate subprocess.d.ts for TypeScript definitions
                generateTaskDts(subprocessPath, subprocess.settings, classIdToIdentifier);

                // Generate subprocess.schema.js for validation
                generateTaskSchema(subprocessPath, subprocess.settings);

                logger.debug(`      ✓ Generated ${subprocess.settings.fields.length} fields, types, and schema for subprocess "${subprocess.name || subprocessFolderName}"`);
            } catch (error) {
                logger.warn(`      ⚠ Failed to generate fields for subprocess "${subprocess.name || subprocessFolderName}": ${error.message}`);
            }
        }

        // Generate methods if subprocess has settings with methods
        if (subprocess.settings?.methods && subprocess.settings.methods.length > 0) {
            generateMethodFiles(
                subprocessPath,
                subprocess.settings.methods,
                rootPath,
                classIdToIdentifier,
                subprocess.settings // Pass subprocess settings as fullClassData for metadata
            );

            logger.debug(`      ✓ Generated ${subprocess.settings.methods.length} methods for subprocess "${subprocess.name || subprocessFolderName}"`);
        }
    });

    logger.debug(`   📦 Generated ${subprocesses.length} subprocesses in subprocesses/ folder`);
}

module.exports = {
    generateSubprocessFiles
};
