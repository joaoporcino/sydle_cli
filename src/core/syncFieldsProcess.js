/**
 * @fileoverview Sync Fields Process Core
 * 
 * Synchronizes fields.js definitions with the Sydle API for Process Versions.
 * Uses fieldApiConverter to convert field definitions and generates
 * patch operations to update the process version in Sydle.
 * 
 * @module core/syncFieldsProcess
 * @requires generators/fieldApiConverter
 */

const fs = require('fs');
const path = require('path');
const { get, patch } = require('../api/main');
const { convertFieldsToApi } = require('../generators/fieldApiConverter');

const PROCESS_VERSION_CLASS_ID = '595c20500000000000000110';

/**
 * Synchronizes fields from a fields.js file with the Sydle API (Process Version)
 * 
 * @param {string} fieldsJsPath - Absolute path to the fields.js file (usually in pin/)
 * @param {string} rootPath - Root project path
 * @param {Object} logger - Logger instance
 * @param {Map} [classIdToIdentifier] - Map of class IDs to identifiers for d.ts generation
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function syncFieldsProcessCore(fieldsJsPath, rootPath, logger, classIdToIdentifier) {
    const fieldsFolder = path.dirname(fieldsJsPath); // e.g., .../1_0/pin/fields

    // Determine version.json path
    // Traverse up to 5 levels to find version.json
    let cursorPath = fieldsFolder;
    let versionJsonPath = null;

    for (let i = 0; i < 5; i++) {
        const checkPath = path.join(cursorPath, 'version.json');
        if (fs.existsSync(checkPath)) {
            versionJsonPath = checkPath;
            break;
        }
        cursorPath = path.dirname(cursorPath);
    }

    if (!versionJsonPath) {
        logger.error(`❌ version.json not found near ${fieldsJsPath} (searched up to 5 levels)`);
        return { success: false, message: 'version.json not found' };
    }

    try {
        const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
        const versionLabel = versionData.versionLabel || 'unknown';
        const versionRecordId = versionData._id;

        logger.progress(`🔄 [FIELDS] Syncing fields for process version '${versionLabel}' from fields.js`);

        // 1. Load fields.js module
        delete require.cache[require.resolve(fieldsJsPath)];

        let fieldsModule;
        try {
            fieldsModule = require(fieldsJsPath);
        } catch (requireError) {
            logger.error(`   ❌ Failed to load fields.js: ${requireError.message}`);
            return { success: false, message: `Failed to load fields.js: ${requireError.message}` };
        }

        const existingFields = versionData.fields || [];

        // 2. Convert fields to API format
        const newFields = convertFieldsToApi(fieldsModule, existingFields);

        // 3. Get current version from API
        let currentVersion;
        try {
            currentVersion = await get(PROCESS_VERSION_CLASS_ID, versionRecordId);
        } catch (apiError) {
            logger.error(`   ❌ Failed to fetch process version: ${apiError.message}`);
            return { success: false, message: `Failed to fetch process version: ${apiError.message}` };
        }

        if (!currentVersion) {
            logger.error(`   ❌ Process version not found in Sydle`);
            return { success: false, message: 'Process version not found in Sydle' };
        }

        // 4. Build merged fields array
        const currentFields = currentVersion.fields || [];
        const systemFields = currentFields.filter(f => f.identifier && f.identifier.startsWith('_'));
        const userFieldsFromApi = currentFields.filter(f => f.identifier && !f.identifier.startsWith('_'));

        const mergedFields = [...systemFields];

        for (const newField of newFields) {
            const existingApiField = userFieldsFromApi.find(f => f.identifier === newField.identifier);

            if (existingApiField) {
                newField._id = existingApiField._id;
                // Process fields might not have _classRevision in the same way, but preserve if exists
                if (existingApiField._classRevision) {
                    newField._classRevision = existingApiField._classRevision;
                }
            }

            mergedFields.push(newField);
        }

        // 5. Patch
        const updateData = {
            _id: versionRecordId,
            _operationsList: [{
                op: 'replace',
                path: '/fields',
                value: mergedFields
            }]
        };

        await patch(PROCESS_VERSION_CLASS_ID, updateData);

        // 6. Update local version.json
        versionData.fields = mergedFields;
        fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 4), 'utf-8');

        // 7. Regenerate definitions (d.ts and schema) to update IntelliSense
        if (classIdToIdentifier) {
            const { generateClassDts, generateClassSchema } = require('../generators');
            const versionDir = path.dirname(versionJsonPath);
            const processDir = path.dirname(versionDir);
            const processJsonPath = path.join(processDir, 'process.json');

            // Try to set the correct identifier from process.json
            if (fs.existsSync(processJsonPath)) {
                try {
                    logger.debug(`      Checking process.json at: ${processJsonPath}`);
                    const processData = JSON.parse(fs.readFileSync(processJsonPath, 'utf8'));
                    if (processData.identifier) {
                        versionData.identifier = processData.identifier;
                        logger.debug(`      Set identifier to: ${versionData.identifier}`);
                    } else {
                        logger.warn(`      process.json has no identifier`);
                    }
                } catch (e) {
                    logger.warn(`      ⚠ Failed to read process.json: ${e.message}`);
                }
            } else {
                logger.warn(`      process.json not found at: ${processJsonPath}`);
            }

            const pinPath = path.join(versionDir, 'pin');
            const CLASS_CLASS_ID = '000000000000000000000000';

            // Ensure pin folder exists (it should)
            if (fs.existsSync(pinPath)) {
                await generateClassDts(versionData, pinPath, { classIdToIdentifier, classId: CLASS_CLASS_ID });
                generateClassSchema(versionData, pinPath);
                logger.debug(`      ✓ Regenerated class.d.ts and class.schema.js for IntelliSense`);
            }
        }

        logger.success(`   ✓ Fields synced (${newFields.length} user fields, ${systemFields.length} system fields)`);
        return { success: true };

    } catch (error) {
        logger.error(`   ❌ Failed: ${error.message}`);
        if (error.stack) logger.debug(error.stack);
        return { success: false, message: error.message };
    }
}

module.exports = { syncFieldsProcessCore };
