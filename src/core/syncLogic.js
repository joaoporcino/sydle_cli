const fs = require('fs');
const path = require('path');
const { get, patch, create } = require('../api/main');

const CLASS_METADATA_ID = '000000000000000000000000';

/**
 * Ensures a class exists in Sydle, creating it if needed
 * @param {string} classJsonPath - Absolute path to class.json
 * @param {Object} logger - Logger instance
 * @returns {Promise<{success: boolean, classData: Object|null, created: boolean}>}
 */
async function ensureClassExists(classJsonPath, logger) {
    if (!fs.existsSync(classJsonPath)) {
        return { success: false, classData: null, created: false };
    }

    const classData = JSON.parse(fs.readFileSync(classJsonPath, 'utf-8'));
    const className = classData.identifier || classData.name;

    // Check if this is an unpublished draft (_revision: "0" indicates not yet created in Sydle)
    const isUnpublishedDraft = classData._revision === "0" || classData._revision === 0;

    if (isUnpublishedDraft) {
        logger.progress(`📤 Publishing class '${className}' to Sydle...`);

        // Clean up draft-specific fields before creating
        const createData = { ...classData };
        delete createData._revision;
        delete createData._lastUpdateDate;
        delete createData._lastUpdateUser;
        delete createData._creationDate;
        delete createData._creationUser;
        delete createData._classRevision;
        delete createData._id; // Let Sydle assign the ID

        try {
            // Create class in Sydle
            const createdClass = await create(CLASS_METADATA_ID, createData);

            // Update local class.json with new _id and _revision from Sydle
            classData._id = createdClass._id;
            classData._revision = createdClass._revision;
            fs.writeFileSync(classJsonPath, JSON.stringify(classData, null, 4), 'utf-8');

            logger.success(`✓ Class published in Sydle (ID: ${createdClass._id})`);
            return { success: true, classData: createdClass, created: true };
        } catch (createError) {
            logger.error(`❌ Failed to publish class: ${createError.message}`);
            return { success: false, classData: null, created: false };
        }
    }

    // Class already exists (has _revision > 0), fetch it to verify
    try {
        const currentClass = await get(CLASS_METADATA_ID, classData._id);
        return { success: true, classData: currentClass, created: false };
    } catch (error) {
        // This shouldn't happen for published classes, but handle edge case
        logger.error(`❌ Failed to fetch class '${className}': ${error.message}`);
        return { success: false, classData: null, created: false };
    }
}

/**
 * Core logic to sync a method to Sydle
 * @param {string} methodJsonPath - Absolute path to method.json
 * @param {string} classId - Class Id
 * @param {string} rootPath - Absolute path to the root environment folder (e.g. sydle-dev)
 * @param {Object} logger - Logger instance
 * @returns {Promise<{success: boolean, skipped?: boolean, message?: string}>}
 */
async function syncMethodCore(methodJsonPath, classId, rootPath, logger) {
    const relativePath = path.relative(rootPath, methodJsonPath);
    const parts = relativePath.split(path.sep);

    // Extract className and methodName
    const methodName = parts[parts.length - 2];
    const className = parts[parts.length - 3];

    // Skip system methods that have no custom scripts
    const isSystemMethod = methodName.startsWith('_');

    try {
        logger.progress(`🔄 ${className}/${methodName}`);

        // Read method.json
        const methodData = JSON.parse(fs.readFileSync(methodJsonPath, 'utf-8'));

        // Read all scripts
        const methodFolder = path.dirname(methodJsonPath);
        const scriptsFolder = path.join(methodFolder, 'scripts');

        if (!fs.existsSync(scriptsFolder)) {
            if (isSystemMethod) {
                logger.log(`   ⏭ Skipped (system method, no scripts)`);
                return { success: true, skipped: true };
            }
            logger.warn(`   ⚠ No scripts folder found`);
            return { success: false };
        }

        const scriptFiles = fs.readdirSync(scriptsFolder)
            .filter(file => file.match(/^script_\d+\.js$/))
            .sort((a, b) => {
                const numA = parseInt(a.match(/script_(\d+)\.js/)[1], 10);
                const numB = parseInt(b.match(/script_(\d+)\.js/)[1], 10);
                return numA - numB;
            });

        if (scriptFiles.length === 0) {
            if (isSystemMethod) {
                logger.log(`   ⏭ Skipped (system method, no scripts)`);
                return { success: true, skipped: true };
            }
            logger.warn(`   ⚠ No script files found`);
            return { success: false };
        }

        // Read all scripts
        const scripts = [];
        for (const scriptFile of scriptFiles) {
            const scriptPath = path.join(scriptsFolder, scriptFile);
            const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
            scripts.push(scriptContent);
        }

        methodData.scripts = scripts;

        // Write updated method.json
        fs.writeFileSync(methodJsonPath, JSON.stringify(methodData, null, 4), 'utf-8');

        // Get class _id
        const classFolder = path.dirname(methodFolder);
        const classJsonPath = path.join(classFolder, 'class.json');

        if (!fs.existsSync(classJsonPath)) {
            logger.error(`   ❌ class.json not found`);
            return { success: false };
        }

        const classData = JSON.parse(fs.readFileSync(classJsonPath, 'utf-8'));
        const classRecordId = classData._id;

        // Get current class to find method index
        const currentClass = await get(classId, classRecordId);
        if (!currentClass || !currentClass.methods) {
            logger.error(`   ❌ Failed to fetch class data`);
            return { success: false };
        }

        const methodIndex = currentClass.methods.findIndex(m => m.identifier === methodName);

        // Prepare Patch Data
        let patchOperation;
        let patchPath;
        let actionDescription;

        if (methodIndex === -1) {
            // Method doesn't exist, create it (add to end of list)
            patchOperation = 'add';
            patchPath = '/methods/-';
            actionDescription = 'Created';
        } else {
            // Method exists, update it
            patchOperation = 'replace';
            patchPath = `/methods/${methodIndex}`;
            actionDescription = 'Synced';
        }

        const updateData = {
            _id: classRecordId,
            _operationsList: [{
                op: patchOperation,
                path: patchPath,
                value: methodData
            }]
        };

        await patch(classId, updateData);

        logger.success(`   ✓ ${actionDescription} (${scripts.length} script(s))`);
        return { success: true };

    } catch (error) {
        logger.error(`   ❌ Failed: ${error.message}`);
        if (error.stack) logger.debug(error.stack);
        return { success: false };
    }
}

module.exports = { syncMethodCore, ensureClassExists };
