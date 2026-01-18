const fs = require('fs');
const path = require('path');
const { get, patch } = require('../api/main');

/**
 * Core logic to sync a method to Sydle
 * @param {string} methodJsonPath - Absolute path to method.json
 * @param {string} classId - Class Id
 * @param {string} rootPath - Absolute path to the root environment folder (e.g. sydle-dev)
 * @param {Object} logger - Logger instance
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function syncMethodCore(methodJsonPath, classId, rootPath, logger) {
    const relativePath = path.relative(rootPath, methodJsonPath);
    const parts = relativePath.split(path.sep);

    // Extract className and methodName
    const methodName = parts[parts.length - 2];
    const className = parts[parts.length - 3];

    try {
        logger.progress(`🔄 ${className}/${methodName}`);

        // Read method.json
        const methodData = JSON.parse(fs.readFileSync(methodJsonPath, 'utf-8'));

        // Read all scripts
        const methodFolder = path.dirname(methodJsonPath);
        const scriptsFolder = path.join(methodFolder, 'scripts');

        if (!fs.existsSync(scriptsFolder)) {
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

module.exports = { syncMethodCore };
