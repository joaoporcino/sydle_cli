/**
 * Generic generator for diagram element files (tasks, subprocesses, events, gateways)
 * Creates element folder structure with methods and fields
 */

const fs = require('fs');
const path = require('path');
const { generateMethodFiles } = require('./methodFiles');
const { generateFieldsSchema } = require('./fieldsSchema');
const { generateTaskDts } = require('./taskDts');
const { generateTaskSchema } = require('./taskSchema');
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
 * Generate element files from diagram elements array
 * @param {string} diagramPath - Path to the diagram folder
 * @param {Array} elements - Array of element objects from diagram
 * @param {string} elementType - Type of element ('tasks', 'subprocesses', 'events', 'gateways')
 * @param {string} rootPath - Root path (sydle-process-[env])
 * @param {Map} classIdToIdentifier - Map of class IDs to identifiers
 */
function generateDiagramElementFiles(diagramPath, elements, elementType, rootPath, classIdToIdentifier) {
    if (!elements || elements.length === 0) {
        return;
    }

    const elementsPath = path.join(diagramPath, elementType);

    if (!fs.existsSync(elementsPath)) {
        fs.mkdirSync(elementsPath, { recursive: true });
    }

    const singularType = elementType.endsWith('s') ? elementType.slice(0, -1) : elementType;
    const icons = {
        tasks: '📋',
        subprocesses: '📦',
        events: '⚡',
        gateways: '🔀'
    };
    const icon = icons[elementType] || '📄';

    elements.forEach(element => {
        // Use sanitized name as folder name, fallback to identifier
        const elementFolderName = element.name ? sanitizeFolderName(element.name) : (element.identifier || element._id);
        const elementPath = path.join(elementsPath, elementFolderName);

        if (!fs.existsSync(elementPath)) {
            fs.mkdirSync(elementPath, { recursive: true });
        }

        // Save element.json (complete element data)
        const jsonFileName = `${singularType}.json`;
        fs.writeFileSync(
            path.join(elementPath, jsonFileName),
            JSON.stringify(element, null, 2)
        );

        // Generate fields, schema, and typings if element has settings (even if fields is empty)
        if (element.settings) {
            try {
                // Try to find the interface name from pin/class.d.ts for IntelliSense
                let processFieldsReferencePath = null;
                let processFieldsInterface = null;
                const pinPath = path.join(path.dirname(diagramPath), 'pin');
                const classDtsPath = path.join(pinPath, 'class.d.ts');

                if (fs.existsSync(classDtsPath)) {
                    try {
                        const dtsContent = fs.readFileSync(classDtsPath, 'utf8');
                        // Look for "declare interface (I_Data_...)" to support both I_Data and I_Data_CustomName
                        const match = dtsContent.match(/declare interface (I_Data(?:_\w+)?)/);
                        if (match && match[1]) {
                            processFieldsInterface = match[1];
                            processFieldsReferencePath = path.relative(elementPath, classDtsPath).replace(/\\/g, '/');
                        }
                    } catch (e) {
                        logger.warn(`      ⚠ Failed to read class.d.ts for IntelliSense: ${e.message}`);
                    }
                }

                // Create a class-like object for generateFieldsSchema
                const elementAsClass = {
                    identifier: elementFolderName,
                    name: element.settings._name || element.name || elementFolderName,
                    fields: element.settings.fields || [],
                    processFields: element.settings.processFields || [],
                    processFieldsReferencePath,
                    processFieldsInterface
                };

                // Generate fields.js using SydleZod
                generateFieldsSchema(elementAsClass, elementPath, rootPath);

                // Generate .d.ts for TypeScript definitions
                generateTaskDts(elementPath, element.settings, classIdToIdentifier, elementFolderName);

                // Generate .schema.js for validation
                generateTaskSchema(elementPath, element.settings, elementFolderName);

                const fieldCount = element.settings.fields?.length || 0;
                if (fieldCount > 0) {
                    logger.debug(`      ✓ Generated ${fieldCount} fields, types, and schema for ${singularType} "${element.name || elementFolderName}"`);
                } else {
                    logger.debug(`      ✓ Generated empty fields structure for ${singularType} "${element.name || elementFolderName}"`);
                }
            } catch (error) {
                logger.warn(`      ⚠ Failed to generate fields for ${singularType} "${element.name || elementFolderName}": ${error.message}`);
            }
        }

        // Generate methods if element has settings with methods
        if (element.settings?.methods && element.settings.methods.length > 0) {
            generateMethodFiles(
                elementPath,
                element.settings.methods,
                rootPath,
                classIdToIdentifier,
                element.settings
            );

            logger.debug(`      ✓ Generated ${element.settings.methods.length} methods for ${singularType} "${element.name || elementFolderName}"`);
        }
    });

    logger.debug(`   ${icon} Generated ${elements.length} ${elementType} in ${elementType}/ folder`);
}

module.exports = {
    generateDiagramElementFiles
};
