/**
 * Generator for task files from diagram tasks array
 * Creates task folder structure with methods
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
 * Generate task files from diagram tasks array
 * @param {string} diagramPath - Path to the diagram folder
 * @param {Array} tasks - Array of task objects from diagram
 * @param {string} rootPath - Root path (sydle-process-[env])
 * @param {Map} classIdToIdentifier - Map of class IDs to identifiers
 */
function generateTaskFiles(diagramPath, tasks, rootPath, classIdToIdentifier) {
    if (!tasks || tasks.length === 0) {
        return;
    }

    const tasksPath = path.join(diagramPath, 'tasks');

    if (!fs.existsSync(tasksPath)) {
        fs.mkdirSync(tasksPath, { recursive: true });
    }

    tasks.forEach(task => {
        // Use sanitized name as folder name, fallback to identifier
        const taskFolderName = task.name ? sanitizeFolderName(task.name) : (task.identifier || task._id);
        const taskPath = path.join(tasksPath, taskFolderName);

        if (!fs.existsSync(taskPath)) {
            fs.mkdirSync(taskPath, { recursive: true });
        }

        // Save task.json (complete task data)
        fs.writeFileSync(
            path.join(taskPath, 'task.json'),
            JSON.stringify(task, null, 2)
        );

        // Always generate fields folder and files (even if empty)
        if (task.settings) {
            try {
                // Create fields folder
                const fieldsFolder = path.join(taskPath, 'fields');
                if (!fs.existsSync(fieldsFolder)) {
                    fs.mkdirSync(fieldsFolder, { recursive: true });
                }

                // Create a class-like object for generateFieldsSchema
                const taskAsClass = {
                    identifier: taskFolderName,
                    name: task.settings._name || task.name || taskFolderName,
                    fields: task.settings.fields || []
                };

                // Generate fields.js using SydleZod (correct parameter order: classData, outputPath, rootPath)
                generateFieldsSchema(taskAsClass, fieldsFolder, rootPath);

                // Generate task.d.ts for TypeScript definitions
                generateTaskDts(fieldsFolder, task.settings, classIdToIdentifier, taskFolderName);

                // Generate task.schema.js for validation
                generateTaskSchema(fieldsFolder, task.settings, taskFolderName);

                const fieldCount = task.settings.fields?.length || 0;
                if (fieldCount > 0) {
                    logger.debug(`      ✓ Generated ${fieldCount} fields, types, and schema for task "${task.name || taskFolderName}"`);
                } else {
                    logger.debug(`      ✓ Generated empty fields structure for task "${task.name || taskFolderName}"`);
                }
            } catch (error) {
                logger.warn(`      ⚠ Failed to generate fields for task "${task.name || taskFolderName}": ${error.message}`);
            }
        }

        // Generate methods if task has settings with methods
        if (task.settings?.methods && task.settings.methods.length > 0) {
            generateMethodFiles(
                taskPath,
                task.settings.methods,
                rootPath,
                classIdToIdentifier,
                task.settings // Pass task settings as fullClassData for metadata
            );

            logger.debug(`      ✓ Generated ${task.settings.methods.length} methods for task "${task.name || taskFolderName}"`);
        }
    });

    logger.debug(`   📋 Generated ${tasks.length} tasks in tasks/ folder`);
}

module.exports = {
    generateTaskFiles
};
