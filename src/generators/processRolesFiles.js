/**
 * Generator for process roles files
 * Creates processRoles folder structure with role.json and aclScript.js files
 */

const fs = require('fs');
const path = require('path');

/**
 * Sanitizes a name to be used as a folder name
 * @param {string|Object} name - Name to sanitize
 * @returns {string} Sanitized name
 */
function sanitizeFolderName(name) {
    if (typeof name === 'object' && name !== null) {
        name = name.pt || name.en || Object.values(name)[0];
    }
    if (!name || typeof name !== 'string') return '';

    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^a-z0-9_-]/g, '_')    // Replace invalid chars
        .replace(/_+/g, '_')              // Collapse multiple underscores
        .replace(/^_|_$/g, '');           // Trim underscores
}

/**
 * Generate processRoles structure for a process version
 * @param {string} versionPath - Path to the version folder
 * @param {Array} processRoles - Array of process role objects
 */
function generateProcessRolesFiles(versionPath, processRoles) {
    if (!processRoles || !Array.isArray(processRoles) || processRoles.length === 0) {
        return;
    }

    const processRolesPath = path.join(versionPath, 'processRoles');

    if (!fs.existsSync(processRolesPath)) {
        fs.mkdirSync(processRolesPath, { recursive: true });
    }

    for (const role of processRoles) {
        if (!role.identifier) continue;

        // Create role folder using identifier
        const roleFolderName = sanitizeFolderName(role.identifier);
        const rolePath = path.join(processRolesPath, roleFolderName);

        if (!fs.existsSync(rolePath)) {
            fs.mkdirSync(rolePath, { recursive: true });
        }

        // Save role.json
        fs.writeFileSync(
            path.join(rolePath, 'role.json'),
            JSON.stringify(role, null, 2)
        );

        // Save aclScript.js if exists
        if (role.aclScript) {
            fs.writeFileSync(
                path.join(rolePath, 'aclScript.js'),
                role.aclScript
            );
        }
    }
}

module.exports = {
    generateProcessRolesFiles
};
