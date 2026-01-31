const fs = require('fs');
const path = require('path');
const { get, patch, create } = require('../api/main');

const PROCESS_VERSION_CLASS_ID = '595c20500000000000000110';

/**
 * Ensures a process version exists in Sydle, creating it if needed
 * @param {string} versionJsonPath - Absolute path to version.json
 * @param {Object} logger - Logger instance
 * @returns {Promise<{success: boolean, versionData: Object|null, created: boolean}>}
 */
async function ensureProcessVersionExists(versionJsonPath, logger) {
    if (!fs.existsSync(versionJsonPath)) {
        return { success: false, versionData: null, created: false };
    }

    const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
    const versionLabel = versionData.versionLabel || 'unknown';

    // Check if this is an unpublished draft (_revision: "0" indicates not yet created in Sydle)
    const isUnpublishedDraft = versionData._revision === "0" || versionData._revision === 0;

    if (isUnpublishedDraft) {
        logger.progress(`📤 Publishing process version '${versionLabel}' to Sydle...`);

        // Clean up draft-specific fields before creating
        const createData = { ...versionData };
        delete createData._revision;
        delete createData._lastUpdateDate;
        delete createData._lastUpdateUser;
        delete createData._creationDate;
        delete createData._creationUser;
        delete createData._classRevision;
        delete createData._id; // Let Sydle assign the ID

        try {
            // Create process version in Sydle
            const createdVersion = await create(PROCESS_VERSION_CLASS_ID, createData);

            // Update local version.json with new _id and _revision from Sydle
            versionData._id = createdVersion._id;
            versionData._revision = createdVersion._revision;
            fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 4), 'utf-8');

            logger.success(`✓ Process version published in Sydle (ID: ${createdVersion._id})`);
            return { success: true, versionData: createdVersion, created: true };
        } catch (createError) {
            logger.error(`❌ Failed to publish process version: ${createError.message}`);
            return { success: false, versionData: null, created: false };
        }
    }

    // Version already exists (has _revision > 0), fetch it to verify
    try {
        const currentVersion = await get(PROCESS_VERSION_CLASS_ID, versionData._id);
        return { success: true, versionData: currentVersion, created: false };
    } catch (error) {
        // This shouldn't happen for published versions, but handle edge case
        logger.error(`❌ Failed to fetch process version '${versionLabel}': ${error.message}`);
        return { success: false, versionData: null, created: false };
    }
}

/**
 * Core logic to sync a process version method (pin methods) to Sydle
 * @param {string} methodJsonPath - Absolute path to method.json (inside pin folder)
 * @param {string} rootPath - Absolute path to the root environment folder (e.g. sydle-process-dev)
 * @param {Object} logger - Logger instance
 * @returns {Promise<{success: boolean, skipped?: boolean, message?: string}>}
 */
async function syncProcessMethodCore(methodJsonPath, rootPath, logger) {
    const relativePath = path.relative(rootPath, methodJsonPath);
    const parts = relativePath.split(path.sep);

    // Extract context: group/process/version/pin/methods/method
    // path: .../group/process/version/pin/methods/method/method.json
    // parts: [group, process, version, pin, methods, method, method.json]

    let methodName, versionLabel, processName;

    // Check if we are in the new structure with 'methods' folder
    const methodsIndex = parts.indexOf('methods');
    if (methodsIndex !== -1 && parts[methodsIndex - 1] === 'pin') {
        methodName = parts[methodsIndex + 1];
        versionLabel = parts[methodsIndex - 2];
        processName = parts[methodsIndex - 3];
    } else {
        // Fallback for flat structure or unexpected path
        methodName = parts[parts.length - 2];
        // Ensure we don't pick 'methods' as method name if something is wrong
        if (methodName === 'methods') {
            logger.warn('Skipping sync for intermediate folder "methods"');
            return { success: false };
        }

        // Try to guess version label position based on 'pin'
        const pinIndex = parts.indexOf('pin');
        if (pinIndex !== -1) {
            versionLabel = parts[pinIndex - 1];
            processName = parts[pinIndex - 2];
        } else {
            // Last resort fallback
            versionLabel = parts[parts.length - 4];
            processName = parts[parts.length - 5];
        }
    }

    // Skip system methods that have no custom scripts
    const isSystemMethod = methodName.startsWith('_');

    try {
        logger.progress(`🔄 [METHOD] ${processName}/${versionLabel}/pin/${methodName}`);

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

        // Get version _id
        // Valid path: .../version/pin/methods/MethodName/method.json
        // We need to go up to .../version/version.json

        // Start from methodFolder (.../MethodName)
        let cursorPath = methodFolder;
        let versionJsonPath = null;

        // Traverse up to 5 levels to find version.json
        for (let i = 0; i < 5; i++) {
            const checkPath = path.join(cursorPath, 'version.json');
            if (fs.existsSync(checkPath)) {
                versionJsonPath = checkPath;
                break;
            }
            cursorPath = path.dirname(cursorPath);
        }

        if (!versionJsonPath) {
            // Fallback to strict structure assumption if search fails
            const methodsFolder = path.dirname(methodFolder);
            const pinFolder = path.dirname(methodsFolder);
            const versionFolder = path.dirname(pinFolder);
            versionJsonPath = path.join(versionFolder, 'version.json');
        }

        if (!fs.existsSync(versionJsonPath)) {
            logger.error(`   ❌ version.json not found (searched up to 5 levels)`);
            return { success: false };
        }

        const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
        const versionRecordId = versionData._id;

        // Get current version to find method index
        const currentVersion = await get(PROCESS_VERSION_CLASS_ID, versionRecordId);
        if (!currentVersion || !currentVersion.methods) {
            logger.error(`   ❌ Failed to fetch process version data`);
            return { success: false };
        }

        const methodIndex = currentVersion.methods.findIndex(m => m.identifier === methodName);

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
            _id: versionRecordId,
            _operationsList: [{
                op: patchOperation,
                path: patchPath,
                value: methodData
            }]
        };

        await patch(PROCESS_VERSION_CLASS_ID, updateData);

        logger.success(`   ✓ ${actionDescription} (${scripts.length} script(s))`);
        return { success: true };

    } catch (error) {
        logger.error(`   ❌ Failed: ${error.message}`);
        if (error.stack) logger.debug(error.stack);
        return { success: false };
    }
}

/**
 * Syncs process version fields to Sydle
 * @param {string} versionJsonPath - Absolute path to version.json
 * @param {Object} logger - Logger instance
 * @returns {Promise<{success: boolean}>}
 */
async function syncProcessFieldsCore(versionJsonPath, logger) {
    try {
        if (!fs.existsSync(versionJsonPath)) {
            logger.error(`❌ version.json not found`);
            return { success: false };
        }

        const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
        const versionLabel = versionData.versionLabel || 'unknown';
        const versionRecordId = versionData._id;

        logger.progress(`🔄 Syncing fields for process version '${versionLabel}'`);

        // Get current version from Sydle
        const currentVersion = await get(PROCESS_VERSION_CLASS_ID, versionRecordId);
        if (!currentVersion) {
            logger.error(`   ❌ Failed to fetch process version data`);
            return { success: false };
        }

        // Prepare patch to update fields
        const updateData = {
            _id: versionRecordId,
            _operationsList: [{
                op: 'replace',
                path: '/fields',
                value: versionData.fields || []
            }]
        };

        await patch(PROCESS_VERSION_CLASS_ID, updateData);

        logger.success(`   ✓ Fields synced (${(versionData.fields || []).length} field(s))`);
        return { success: true };

    } catch (error) {
        logger.error(`   ❌ Failed to sync fields: ${error.message}`);
        if (error.stack) logger.debug(error.stack);
        return { success: false };
    }
}

module.exports = {
    ensureProcessVersionExists,
    syncProcessMethodCore,
    syncProcessFieldsCore
};
