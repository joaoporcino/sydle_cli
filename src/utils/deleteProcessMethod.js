const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs');
const { get, patch } = require('../api/main');
const { generateMethodFiles } = require('../generators/methodFiles');

const PROCESS_VERSION_CLASS_ID = '595c20500000000000000110';

/**
 * Handles the deletion of a process method folder (pin method).
 * Prompts the user to confirm deletion from Sydle.
 * If confirmed: Deletes from Sydle.
 * If rejected: Restores the local folder from Sydle.
 * 
 * @param {string} methodFolder - Absolute path to the deleted method folder
 * @param {string} rootPath - Absolute path to the root environment folder (e.g. sydle-process-dev)
 * @param {Object} logger - Logger instance
 */
async function handleProcessMethodDeletion(methodFolder, rootPath, logger) {
    // methodFolder is the absolute path of the folder that WAS deleted.
    const relativePath = path.relative(rootPath, methodFolder);
    const parts = relativePath.split(path.sep);

    // Context: group/process/version/pin/methods/method
    // depth should be 6
    // sydle-process-dev (root) -> group (0) -> process (1) -> version (2) -> pin (3) -> methods (4) -> method (5)

    // Allow flexibility: detect "pin" and "methods"
    // Valid path ends with: .../pin/methods/MethodName

    let methodName, versionLabel, processName;

    // Check for standard structure
    if (parts.length === 6 && parts[3] === 'pin' && parts[4] === 'methods') {
        methodName = parts[5];
        versionLabel = parts[2];
        processName = parts[1];
    } else {
        // Fallback or ignore
        return;
    }

    // Constraint: Do not process system methods (starting with _)
    // Instead of ignoring, we now trigger an automatic rollback
    if (methodName.startsWith('_')) {
        logger.warn(`\n⛔ System method deletion attempt detected: ${methodName}`);
        logger.info('   These methods are protected. Restoring...');
        await restoreProcessMethod(rootPath, parts, methodName, logger);
        return;
    }

    logger.warn(`\n🗑 Detected deletion of process method folder: ${methodName}`);

    // Prompt confirmation
    await new Promise(resolve => setTimeout(resolve, 500));

    let confirmDelete = false;
    try {
        const answers = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirmDelete',
                message: `Do you want to DELETE "${methodName}" from Sydle system as well?`,
                default: false
            }
        ]);
        confirmDelete = answers.confirmDelete;
    } catch (error) {
        logger.error(`Error prompting user: ${error.message}`);
        confirmDelete = false;
    }

    // Get version.json path
    // root/group/process/version/version.json
    const versionFolder = path.resolve(rootPath, parts[0], parts[1], parts[2]);
    const versionJsonPath = path.join(versionFolder, 'version.json');

    if (!fs.existsSync(versionJsonPath)) {
        logger.error('❌ version.json not found. Cannot proceed with delete or restore.');
        return;
    }

    // We need Version ID to interact with Sydle
    let versionId;
    try {
        const localVersionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
        versionId = localVersionData._id;
    } catch (e) {
        logger.error('❌ Failed to read version.json');
        return;
    }

    if (confirmDelete) {
        // --- DELETE FROM SYDLE ---
        logger.progress(`🗑 Deleting ${methodName} from Sydle...`);

        try {
            // 1. Fetch current version state to get the correct array index
            const currentVersion = await get(PROCESS_VERSION_CLASS_ID, versionId);

            if (!currentVersion || !currentVersion.methods) {
                logger.error('❌ Failed to fetch process version definition from Sydle.');
                return;
            }

            const methodIndex = currentVersion.methods.findIndex(m => m.identifier === methodName);

            if (methodIndex === -1) {
                logger.warn(`⚠ Method ${methodName} not found in Sydle (maybe already deleted?).`);
                return;
            }

            // 2. Patch to remove
            const updateData = {
                _id: versionId,
                _operationsList: [{
                    op: 'remove',
                    path: `/methods/${methodIndex}`
                }]
            };

            const response = await patch(PROCESS_VERSION_CLASS_ID, updateData);
            logger.debug(`Patch Response: ${JSON.stringify(response)}`);
            logger.success(`✓ Method ${methodName} deleted from Sydle.`);

        } catch (error) {
            logger.error(`❌ Failed to delete method from Sydle: ${error.message}`);
            logger.info('   You may need to manually restore the local folder or check permissions.');
        }

    } else {
        // --- ROLLBACK (RESTORE) ---
        logger.info(`↺ Restoring local folder for ${methodName}...`);
        await restoreProcessMethod(rootPath, parts, methodName, logger);
    }
}

/**
 * Restores a process method folder from Sydle data.
 */
async function restoreProcessMethod(rootPath, pathParts, methodName, logger) {
    const versionFolder = path.resolve(rootPath, pathParts[0], pathParts[1], pathParts[2]);
    const versionJsonPath = path.join(versionFolder, 'version.json');
    const pinFolder = path.join(versionFolder, 'pin');

    // We need Version ID to interact with Sydle
    let versionId;
    try {
        const localVersionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
        versionId = localVersionData._id;
    } catch (e) {
        logger.error('❌ Failed to read version.json for restore.');
        return;
    }

    try {
        // 1. Fetch version to get method source code
        const currentVersion = await get(PROCESS_VERSION_CLASS_ID, versionId);

        if (!currentVersion || !currentVersion.methods) {
            logger.error('❌ Failed to fetch process version data for restore.');
            return;
        }

        const methodData = currentVersion.methods.find(m => m.identifier === methodName);

        if (!methodData) {
            logger.error(`❌ Method ${methodName} does not exist in Sydle, cannot restore.`);
            return;
        }

        // 2. Re-generate files
        // Ensure we restore into 'methods' subfolder
        const methodsFolder = path.join(pinFolder, 'methods');
        if (!fs.existsSync(methodsFolder)) {
            fs.mkdirSync(methodsFolder, { recursive: true });
        }

        generateMethodFiles(methodsFolder, [methodData], rootPath, new Map(), currentVersion);

        logger.success(`✓ Method ${methodName} restored locally.`);

    } catch (error) {
        logger.error(`❌ Failed to restore method: ${error.message}`);
    }
}

module.exports = { handleProcessMethodDeletion };
