/**
 * @fileoverview Sync Process Roles Core
 * 
 * Synchronizes individual process role definitions with the Sydle API for Process Versions.
 * 
 * @module core/syncProcessRoles
 */

const fs = require('fs');
const path = require('path');
const { get, patch } = require('../api/main');

const PROCESS_VERSION_CLASS_ID = '595c20500000000000000110';

/**
 * Synchronizes a process role from a role.json file with the Sydle API (Process Version)
 * 
 * @param {string} roleJsonPath - Absolute path to the role.json file
 * @param {string} rootPath - Root project path
 * @param {Object} logger - Logger instance
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function syncProcessRolesCore(roleJsonPath, rootPath, logger) {
    const roleFolder = path.dirname(roleJsonPath); // e.g., .../pin/processRoles/default

    // Determine version.json path
    // Traverse up to 5 levels to find version.json
    let cursorPath = roleFolder;
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
        logger.error(`❌ version.json not found near ${roleJsonPath} (searched up to 5 levels)`);
        return { success: false, message: 'version.json not found' };
    }

    try {
        const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
        const versionLabel = versionData.versionLabel || 'unknown';
        const versionRecordId = versionData._id;

        // 1. Read role.json
        const roleData = JSON.parse(fs.readFileSync(roleJsonPath, 'utf-8'));
        const roleName = roleData.name || roleData.identifier; // Identifier is better for matching
        const roleIdentifier = roleData.identifier;

        logger.progress(`🔄 [ROLE] Syncing role '${roleName}' for process version '${versionLabel}'`);

        // 2. Read aclScript.js if exists
        const aclScriptPath = path.join(roleFolder, 'aclScript.js');
        if (fs.existsSync(aclScriptPath)) {
            const aclScript = fs.readFileSync(aclScriptPath, 'utf-8');
            roleData.aclScript = aclScript;
        }

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

        // 4. Find role index
        const currentRoles = currentVersion.processRoles || [];
        const roleIndex = currentRoles.findIndex(r => r.identifier === roleIdentifier);

        // 5. Patch
        let patchOperation;
        let patchPath;
        let actionDescription;

        if (roleIndex === -1) {
            // New role
            patchOperation = 'add';
            patchPath = '/processRoles/-';
            actionDescription = 'Created role';
        } else {
            // Update existing role
            patchOperation = 'replace';
            patchPath = `/processRoles/${roleIndex}`;
            actionDescription = 'Synced role';

            // Preserve _id if exists in API but not in local (though usually local has it)
            if (currentRoles[roleIndex]._id && !roleData._id) {
                roleData._id = currentRoles[roleIndex]._id;
            }
        }

        const updateData = {
            _id: versionRecordId,
            _operationsList: [{
                op: patchOperation,
                path: patchPath,
                value: roleData
            }]
        };

        await patch(PROCESS_VERSION_CLASS_ID, updateData);

        // 6. Update local version.json? 
        // Syncing roles usually implies we should keep version.json consistent if it holds the roles array.
        // However, if roles are split out, version.json might only contain a reference or an empty list if not managed carefully.
        // Assuming version.json intends to mirror the full object, we should update it.

        const localRoles = versionData.processRoles || [];
        const localIndex = localRoles.findIndex(r => r.identifier === roleIdentifier);

        if (localIndex === -1) {
            localRoles.push(roleData);
        } else {
            localRoles[localIndex] = roleData;
        }
        versionData.processRoles = localRoles;

        fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 4), 'utf-8');

        logger.success(`   ✓ ${actionDescription}: ${roleName} ${roleData.aclScript ? '(with ACL script)' : ''}`);
        return { success: true };

    } catch (error) {
        logger.error(`   ❌ Failed: ${error.message}`);
        if (error.stack) logger.debug(error.stack);
        return { success: false, message: error.message };
    }
}

module.exports = { syncProcessRolesCore };
