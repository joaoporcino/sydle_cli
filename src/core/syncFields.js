/**
 * @fileoverview Sync Fields Core
 * 
 * Synchronizes fields.js definitions with the Sydle API.
 * Uses fieldApiConverter to convert field definitions and generates
 * patch operations to update the class in Sydle.
 * 
 * @module core/syncFields
 * @requires generators/fieldApiConverter
 */

const fs = require('fs');
const path = require('path');
const { get, patch } = require('../api/main');
const { convertFieldsToApi } = require('../generators/fieldApiConverter');

/**
 * Class ID for the Class metadata (used for patching classes)
 */
const CLASS_METADATA_ID = '000000000000000000000000';

/**
 * Synchronizes fields from a fields.js file with the Sydle API
 * 
 * @param {string} fieldsJsPath - Absolute path to the fields.js file
 * @param {string} classId - Class metadata ID (usually '000000000000000000000000')
 * @param {string} rootPath - Root project path (e.g., sydle-dev)
 * @param {Object} logger - Logger instance with success, error, warn, progress methods
 * @returns {Promise<{success: boolean, message?: string}>}
 * 
 * @example
 * await syncFieldsCore(
 *     'C:/project/sydle-dev/rh/Funcionario/fields.js',
 *     '000000000000000000000000',
 *     'C:/project/sydle-dev',
 *     logger
 * );
 */
async function syncFieldsCore(fieldsJsPath, classId, rootPath, logger) {
    const classFolder = path.dirname(fieldsJsPath);
    const className = path.basename(classFolder);

    try {
        logger.progress(`🔄 ${className}/fields.js`);

        // 1. Read class.json to get the class _id and existing fields
        const classJsonPath = path.join(classFolder, 'class.json');
        if (!fs.existsSync(classJsonPath)) {
            logger.error(`   ❌ class.json not found in ${classFolder}`);
            return { success: false, message: 'class.json not found' };
        }

        const classData = JSON.parse(fs.readFileSync(classJsonPath, 'utf-8'));
        const classRecordId = classData._id;
        const existingFields = classData.fields || [];

        // 2. Load fields.js module
        // Clear require cache to get fresh content
        delete require.cache[require.resolve(fieldsJsPath)];

        let fieldsModule;
        try {
            fieldsModule = require(fieldsJsPath);
        } catch (requireError) {
            logger.error(`   ❌ Failed to load fields.js: ${requireError.message}`);
            return { success: false, message: `Failed to load fields.js: ${requireError.message}` };
        }

        // 3. Convert fields to API format
        const newFields = convertFieldsToApi(fieldsModule, existingFields);

        if (newFields.length === 0) {
            logger.warn(`   ⚠ No fields found in fields.js`);
            return { success: false, message: 'No fields defined' };
        }

        // 4. Get current class from API to compare
        let currentClass;
        try {
            currentClass = await get(classId, classRecordId);
        } catch (apiError) {
            logger.error(`   ❌ Failed to fetch class: ${apiError.message}`);
            return { success: false, message: `Failed to fetch class: ${apiError.message}` };
        }

        if (!currentClass) {
            logger.error(`   ❌ Class not found in Sydle`);
            return { success: false, message: 'Class not found in Sydle' };
        }

        // 5. Build merged fields array
        // Keep system fields from current class, replace user fields with new ones
        const currentFields = currentClass.fields || [];
        const systemFields = currentFields.filter(f => f.identifier && f.identifier.startsWith('_'));
        const userFieldsFromApi = currentFields.filter(f => f.identifier && !f.identifier.startsWith('_'));

        // Merge: system fields + new fields
        // For new fields, preserve _id from existing API fields when identifier matches
        const mergedFields = [...systemFields];

        for (const newField of newFields) {
            // Find matching field in API to preserve _id
            const existingApiField = userFieldsFromApi.find(f => f.identifier === newField.identifier);

            if (existingApiField) {
                // Preserve _id and _classRevision from existing field
                newField._id = existingApiField._id;
                newField._classRevision = existingApiField._classRevision;
            }

            mergedFields.push(newField);
        }

        // 6. Create patch operation to replace all fields
        const patchData = {
            _id: classRecordId,
            _operationsList: [{
                op: 'replace',
                path: '/fields',
                value: mergedFields
            }]
        };

        // 7. Send patch to API
        try {
            await patch(classId, patchData);
        } catch (patchError) {
            logger.error(`   ❌ Failed to patch: ${patchError.message}`);
            if (patchError.response?.data) {
                logger.error(`      ${JSON.stringify(patchError.response.data)}`);
            }
            return { success: false, message: `Failed to patch: ${patchError.message}` };
        }

        // 8. Update local class.json with new fields
        classData.fields = mergedFields;
        fs.writeFileSync(classJsonPath, JSON.stringify(classData, null, 2), 'utf-8');

        const userFieldCount = newFields.length;
        logger.success(`   ✓ Synced (${userFieldCount} user fields, ${systemFields.length} system fields)`);

        return { success: true };

    } catch (error) {
        logger.error(`   ❌ Failed: ${error.message}`);
        if (error.stack) logger.debug?.(error.stack);
        return { success: false, message: error.message };
    }
}

module.exports = { syncFieldsCore, CLASS_METADATA_ID };
