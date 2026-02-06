/**
 * @fileoverview Sync Task Fields Core
 * 
 * Synchronizes fields.js (processFields) definitions from a Task
 * with the Task's JSON and subsequently the Sydle API.
 * 
 * @module core/syncTaskFields
 */

const fs = require('fs');
const path = require('path');
const { syncDiagramTaskCore } = require('./syncLogicDiagram');
const { createLogger } = require('../utils/logger');

/**
 * Synchronizes task fields from a fields.js file with task.json and Sydle
 * 
 * @param {string} fieldsJsPath - Absolute path to the task's fields.js file
 * @param {string} rootPath - Root project path
 * @param {Object} logger - Logger instance
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function syncTaskFieldsCore(fieldsJsPath, rootPath, logger) {
    try {
        const taskFolder = path.dirname(fieldsJsPath);
        const taskJsonPath = path.join(taskFolder, 'task.json');

        if (!fs.existsSync(taskJsonPath)) {
            logger.error(`❌ task.json not found in ${taskFolder}`);
            return { success: false, message: 'task.json not found' };
        }

        logger.progress(`🔄 [TASK FIELDS] Syncing fields.js for task at ${path.basename(taskFolder)}`);

        // 1. Load processFields from file content (Regex) to allow it NOT to be exported
        const fieldsFileContent = fs.readFileSync(fieldsJsPath, 'utf8');

        // Regex to find: const processFields = ["..."] or similar
        const processFieldsRegex = /const\s+processFields\s*=\s*(\[[\s\S]*?\]);/;
        const processFieldsMatch = fieldsFileContent.match(processFieldsRegex);

        let requestedProcessFields = [];

        if (processFieldsMatch) {
            try {
                // Determine if it's a simple string array or complex
                // We will try a lenient JSON parse by replacing single quotes with double quotes
                // This is a heuristic. Ideally we'd use a JS parser.
                let arrayString = processFieldsMatch[1];
                // Replace ' with " only if they are wrapping strings? 
                // Simple regex extraction is likely safer for ["foo", 'bar'] cases
                const itemRegex = /(["'])(.*?)\1/g;
                let m;
                while ((m = itemRegex.exec(arrayString)) !== null) {
                    requestedProcessFields.push(m[2]);
                }
            } catch (e) {
                logger.warn(`Could not parse processFields array: ${e.message}`);
            }
        }

        // Fallback: Try to load via require if regex found nothing
        if (requestedProcessFields.length === 0) {
            try {
                delete require.cache[require.resolve(fieldsJsPath)];
                const mod = require(fieldsJsPath);
                if (mod.processFields) {
                    requestedProcessFields = mod.processFields;
                }
            } catch (err) {
                // ignore
            }
        }

        logger.debug(`      Requested processFields: ${JSON.stringify(requestedProcessFields)}`);

        // Load module for local properties (if valid JS, otherwise empty)
        let fieldsModule = {};
        try {
            delete require.cache[require.resolve(fieldsJsPath)];
            fieldsModule = require(fieldsJsPath);
        } catch (e) {
            // If file is not valid JS due to partial editing, we might fail here
            // but we continue with processFields found via regex
        }

        // 2. Find version.json to get Process Fields
        // Traverse up: task -> tasks -> diagram -> 1_1 (version) -> version.json
        // Roughly 4 levels up from task folder
        let versionJsonPath = null;
        let p = taskFolder;
        for (let i = 0; i < 5; i++) {
            const check = path.join(p, 'version.json');
            if (fs.existsSync(check)) {
                versionJsonPath = check;
                break;
            }
            p = path.dirname(p);
        }

        if (!versionJsonPath) {
            logger.error(`❌ version.json not found (needed to resolve process fields)`);
            return { success: false, message: 'version.json not found' };
        }
        logger.debug(`      Found version.json at: ${versionJsonPath}`);

        const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
        const availableProcessFields = versionData.fields || [];
        logger.debug(`      Available process fields count: ${availableProcessFields.length}`);

        // 3. Resolve requested fields
        const resolvedProcessFields = [];
        const missingFields = [];

        for (const identifier of requestedProcessFields) {
            const field = availableProcessFields.find(f => f.identifier === identifier);
            if (field) {
                resolvedProcessFields.push(field);
            } else {
                missingFields.push(identifier);
            }
        }

        if (missingFields.length > 0) {
            logger.warn(`   ⚠ The following processFields were not found in the process version: ${missingFields.join(', ')}`);
        }

        // 4. Update task.json (settings.processFields)
        const taskData = JSON.parse(fs.readFileSync(taskJsonPath, 'utf8'));

        if (!taskData.settings) taskData.settings = {};

        taskData.settings.processFields = resolvedProcessFields;

        // Also check for local task fields (custom fields defined in fields.js)
        // Filter out 'processFields' from exports to get local definitions
        const localFieldsDefinition = {};
        for (const [key, val] of Object.entries(fieldsModule)) {
            if (key !== 'processFields') {
                localFieldsDefinition[key] = val;
            }
        }

        // Convert local fields using existing converter (if any)
        if (Object.keys(localFieldsDefinition).length > 0) {
            const { convertFieldsToApi } = require('../generators/fieldApiConverter');
            const existingTaskFields = taskData.settings.fields || [];
            const newLocalFields = convertFieldsToApi(localFieldsDefinition, existingTaskFields);
            taskData.settings.fields = newLocalFields;
        } else {
            // If fields.js has NO local fields, we set fields to empty array?
            // Yes, fields.js is source of truth.
            taskData.settings.fields = [];
        }

        fs.writeFileSync(taskJsonPath, JSON.stringify(taskData, null, 2));
        logger.debug(`   ✓ Updated task.json with ${resolvedProcessFields.length} process fields and ${taskData.settings.fields.length} local fields`);

        // 5. Sync Diagram Task to Sydle
        // This reuses the existing logic which pushes task.json to Sydle
        await syncDiagramTaskCore(taskJsonPath, rootPath, logger);

        // 6. Auto-populate module.exports in fields.js
        if (resolvedProcessFields.length > 0) {
            // Re-read content
            let currentContent = fs.readFileSync(fieldsJsPath, 'utf8');
            let hasChanges = false;

            // We need source code from PIN
            const versionFolder = path.dirname(versionJsonPath);
            const potentialFieldsPaths = [
                path.join(versionFolder, 'pin', 'fields.js'),
                path.join(versionFolder, 'pin', 'fields', 'fields.js')
            ];

            let sourceFieldsPath = potentialFieldsPaths.find(p => fs.existsSync(p));
            let sourceFieldsContent = '';

            if (sourceFieldsPath) {
                sourceFieldsContent = fs.readFileSync(sourceFieldsPath, 'utf8');
            } else {
                logger.warn('   ⚠ Could not find source fields.js to copy definitions from.');
            }

            const moduleExportsRegex = /module\.exports\s*=\s*\{([\s\S]*?)\};/;
            const match = currentContent.match(moduleExportsRegex);

            if (match && sourceFieldsContent) {
                const currentBody = match[1];
                let newBody = currentBody;

                // Remove processFields from exports if present (User Request)
                newBody = newBody.replace(/\/\/\s*Exporta os campos do processo para uso externo\s*/, '');

                const processFieldsExportRegex = /\bprocessFields\s*(,)?\s*/g;
                if (processFieldsExportRegex.test(newBody)) {
                    newBody = newBody.replace(processFieldsExportRegex, '');
                    hasChanges = true;
                }

                for (const field of resolvedProcessFields) {
                    const identifier = field.identifier;

                    // Check if already exported using regex to be safe
                    const exactExportRegex = new RegExp(`\\b${identifier}\\s*(:|,)`, 'g');

                    if (!exactExportRegex.test(currentBody) && !currentBody.includes(`"${identifier}"`) && !currentBody.includes(`'${identifier}'`)) {

                        // Extract definition from sourceFieldsContent
                        const sourceMatch = sourceFieldsContent.match(moduleExportsRegex);
                        if (sourceMatch) {
                            const sourceBody = sourceMatch[1];
                            const keyStartRegex = new RegExp(`\\b${identifier}\\s*:\\s*sy\\.`, 'g');
                            const keyMatch = keyStartRegex.exec(sourceBody);

                            if (keyMatch) {
                                const startIndex = keyMatch.index;

                                let i = startIndex;
                                while (i < sourceBody.length && sourceBody[i] !== ':') i++;
                                i++; // skip colon

                                let valueStart = i;
                                let valueEnd = i;
                                let foundEnd = false;
                                let openParens = 0;
                                let inString = false;
                                let stringChar = '';
                                const len = sourceBody.length;

                                for (let j = valueStart; j < len; j++) {
                                    const char = sourceBody[j];
                                    if (inString) {
                                        if (char === stringChar && sourceBody[j - 1] !== '\\') inString = false;
                                        continue;
                                    }
                                    if (char === "'" || char === '"' || char === '`') {
                                        inString = true;
                                        stringChar = char;
                                        continue;
                                    }
                                    if (char === '(') openParens++;
                                    if (char === ')') openParens--;
                                    if (char === ',' && openParens === 0) {
                                        valueEnd = j;
                                        foundEnd = true;
                                        break;
                                    }
                                }

                                if (!foundEnd) valueEnd = len;

                                const extractedValue = sourceBody.substring(valueStart, valueEnd).trim();
                                const entry = `\n    ${identifier}: ${extractedValue},`;

                                // Ensure comma on previous item if needed
                                const typesOfEndChars = /[a-zA-Z0-9_)'"}\]]/;
                                if (newBody.trim().length > 0 && typesOfEndChars.test(newBody.trim().slice(-1))) {
                                    newBody = newBody.replace(/(\s*)$/, `,$1`);
                                }

                                newBody += entry;
                                hasChanges = true;
                            }
                        }
                    }
                }

                if (hasChanges) {
                    // Ensure newline before closing brace
                    if (!newBody.endsWith('\n')) {
                        newBody += '\n';
                    }
                    currentContent = currentContent.replace(match[1], newBody);
                    fs.writeFileSync(fieldsJsPath, currentContent, 'utf8');
                    logger.success(`   ✓ Auto-populated module.exports with full source definitions`);
                }
            }
        }

        return { success: true };

    } catch (error) {
        logger.error(`   ❌ Failed to sync task fields: ${error.message}`);
        return { success: false, message: error.message };
    }
}

module.exports = { syncTaskFieldsCore };
