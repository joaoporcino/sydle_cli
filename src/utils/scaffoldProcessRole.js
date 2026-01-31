/**
 * @fileoverview Process Role Scaffolding Utils
 * 
 * Handles the value creation of new process roles when a folder is created.
 * Fetches a draft from Sydle API using the Role Class ID (found in sibling roles)
 * and generates role.json and aclScript.js.
 * 
 * @module utils/scaffoldProcessRole
 */

const fs = require('fs');
const path = require('path');
const { createDraft } = require('../api/main');

/**
 * Scaffolds a new process role in the given folder.
 * 
 * @param {string} roleFolder - Absolute path to the new role folder
 * @param {string} rootPath - Root project path
 * @param {string} roleName - Name of the new role (folder name)
 * @param {Object} logger - Logger instance
 */
async function scaffoldProcessRole(roleFolder, rootPath, roleName, logger) {
    try {
        // Check if role.json already exists (avoid overwriting)
        if (fs.existsSync(path.join(roleFolder, 'role.json'))) {
            return;
        }

        logger.progress(`🏗 Scaffolding new process role: ${roleName}`);

        // 1. Find a sibling role to get the Class ID
        // The parent folder 'processRoles' contains all roles.
        const processRolesFolder = path.dirname(roleFolder);
        const siblingFolders = fs.readdirSync(processRolesFolder)
            .filter(f => {
                const fullPath = path.join(processRolesFolder, f);
                return fs.statSync(fullPath).isDirectory() && f !== roleName;
            });

        let roleClassId = '595c20500000000000000105'; // Default fallback (ProcessRole Class ID)

        if (siblingFolders.length > 0) {
            // Try to find a role.json in siblings to extract valid _class._id
            for (const sibling of siblingFolders) {
                const siblingRoleJsonPath = path.join(processRolesFolder, sibling, 'role.json');
                if (fs.existsSync(siblingRoleJsonPath)) {
                    try {
                        const siblingData = JSON.parse(fs.readFileSync(siblingRoleJsonPath, 'utf-8'));
                        if (siblingData._class && siblingData._class._id) {
                            roleClassId = siblingData._class._id;
                            // logger.debug(`Found Role Class ID from sibling '${sibling}': ${roleClassId}`);
                            break;
                        }
                    } catch (e) {
                        // ignore malformed siblings
                    }
                }
            }
        }

        // 2. Fetch Draft from Sydle
        // Parameter: identifier = roleName
        let draftData;
        try {
            draftData = await createDraft(roleClassId, { identifier: roleName, name: roleName });
        } catch (apiError) {
            logger.error(`❌ Failed to create role draft: ${apiError.message}`);
            // Fallback to minimal JSON if API fails?
            // For now, let's just create a basic structure so user isn't stuck empty
            draftData = {
                identifier: roleName,
                name: roleName,
                _class: { _id: roleClassId },
                aclScript: '// Access Control Logic'
            };
        }

        // 3. Write role.json
        // Ensure mandatory fields have defaults if draft didn't provide them
        if (!draftData.accessLevel) draftData.accessLevel = 'DYNAMIC';
        if (!draftData.authorization) draftData.authorization = 'MANAGER';

        // Extract aclScript to separate file if present
        let aclScriptContent = '// ACL Script';
        if (draftData.aclScript) {
            aclScriptContent = draftData.aclScript;
            // Keep specific pointer or just relying on sync logic to merge?
            // syncProcessRoles.js reads local aclScript.js and overrides property.
            // But role.json usually keeps the property in the file locally too for reference.
            // Let's keep it in role.json but also write the .js file.
        }

        // Write files
        const roleJsonPath = path.join(roleFolder, 'role.json');
        const aclScriptPath = path.join(roleFolder, 'aclScript.js');

        fs.writeFileSync(roleJsonPath, JSON.stringify(draftData, null, 4));
        fs.writeFileSync(aclScriptPath, aclScriptContent);

        logger.success(`✓ Process role '${roleName}' scaffolded successfully.`);

    } catch (error) {
        logger.error(`❌ Error scaffolding role: ${error.message}`);
    }
}

module.exports = { scaffoldProcessRole };
