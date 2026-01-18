const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs');
const { get, patch } = require('../api/main');
const { generateMethodFiles } = require('../generators/methodFiles');

/**
 * Handles the deletion of a method folder.
 * Prompts the user to confirm deletion from Sydle.
 * If confirmed: Deletes from Sydle.
 * If rejected: Restores the local folder from Sydle.
 * 
 * @param {string} methodFolder - Absolute path to the deleted method folder
 * @param {string} rootPath - Absolute path to the root environment folder (e.g. sydle-dev)
 * @param {Object} logger - Logger instance
 */
async function handleMethodDeletion(methodFolder, rootPath, logger) {
    // methodFolder is the absolute path of the folder that WAS deleted.
    const relativePath = path.relative(rootPath, methodFolder);
    const parts = relativePath.split(path.sep);

    // Structure: packageName / ClassName / MethodName
    if (parts.length !== 3) {
        return;
    }

    const methodName = parts[2];
    const className = parts[1];
    const packageName = parts[0];

    // Constraint: Do not process system methods (starting with _)
    // Instead of ignoring, we now trigger an automatic rollback
    if (methodName.startsWith('_')) {
        logger.warn(`\n⛔ System method deletion attempt detected: ${methodName}`);
        logger.info('   These methods are protected. Restoring...');
        await restoreMethod(rootPath, packageName, className, methodName, logger);
        return;
    }

    logger.warn(`\n🗑 Detected deletion of method folder: ${methodName}`);

    // Prompt confirmation
    // We use a small timeout to ensure the log is visible before the prompt clears/interferes
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
        // If prompt fails, default to 'No' (Safe default)
        confirmDelete = false;
    }

    const classJsonPath = path.join(rootPath, packageName, className, 'class.json');
    if (!fs.existsSync(classJsonPath)) {
        logger.error('❌ class.json not found. Cannot proceed with delete or restore.');
        return;
    }

    // We need Class ID to interact with Sydle
    let classId;
    try {
        const localClassData = JSON.parse(fs.readFileSync(classJsonPath, 'utf8'));
        classId = localClassData._id;
    } catch (e) {
        logger.error('❌ Failed to read class.json');
        return;
    }

    const classMetadataId = '000000000000000000000000'; // Standard Class Metadata ID

    if (confirmDelete) {
        // --- DELETE FROM SYDLE ---
        logger.progress(`🗑 Deleting ${methodName} from Sydle...`);

        try {
            // 1. Fetch current class state to get the correct array index
            const currentClass = await get(classMetadataId, classId);

            if (!currentClass || !currentClass.methods) {
                logger.error('❌ Failed to fetch class definition from Sydle.');
                return;
            }

            const methodIndex = currentClass.methods.findIndex(m => m.identifier === methodName);

            if (methodIndex === -1) {
                logger.warn(`⚠ Method ${methodName} not found in Sydle (maybe already deleted?).`);
                return;
            }

            // 2. Patch to remove
            const updateData = {
                _id: classId,
                _operationsList: [{
                    op: 'remove',
                    path: `/methods/${methodIndex}`
                }]
            };

            const response = await patch(classMetadataId, updateData);
            logger.debug(`Patch Response: ${JSON.stringify(response)}`);
            logger.success(`✓ Method ${methodName} deleted from Sydle.`);

        } catch (error) {
            logger.error(`❌ Failed to delete method from Sydle: ${error.message}`);
            logger.info('   You may need to manually restore the local folder or check permissions.');
        }

    } else {
        // --- ROLLBACK (RESTORE) ---
        logger.info(`↺ Restoring local folder for ${methodName}...`);
        await restoreMethod(rootPath, packageName, className, methodName, logger);
    }
}

/**
 * Restores a method folder from Sydle data.
 */
async function restoreMethod(rootPath, packageName, className, methodName, logger) {
    const classJsonPath = path.join(rootPath, packageName, className, 'class.json');

    // We need Class ID to interact with Sydle
    let classId;
    try {
        const localClassData = JSON.parse(fs.readFileSync(classJsonPath, 'utf8'));
        classId = localClassData._id;
    } catch (e) {
        logger.error('❌ Failed to read class.json for restore.');
        return;
    }

    const classMetadataId = '000000000000000000000000'; // Standard Class Metadata ID

    try {
        // 1. Fetch class to get method source code
        const currentClass = await get(classMetadataId, classId);

        if (!currentClass || !currentClass.methods) {
            logger.error('❌ Failed to fetch class data for restore.');
            return;
        }

        const methodData = currentClass.methods.find(m => m.identifier === methodName);

        if (!methodData) {
            logger.error(`❌ Method ${methodName} does not exist in Sydle, cannot restore.`);
            return;
        }

        // 2. Re-generate files
        const classPath = path.join(rootPath, packageName, className);

        // Pass empty map for classIdToIdentifier
        generateMethodFiles(classPath, [methodData], rootPath, new Map(), currentClass);

        logger.success(`✓ Method ${methodName} restored locally.`);

    } catch (error) {
        logger.error(`❌ Failed to restore method: ${error.message}`);
    }
}

module.exports = { handleMethodDeletion };
