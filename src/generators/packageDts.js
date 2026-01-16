/**
 * Generator for package.d.ts files
 * Creates package-level TypeScript definitions with namespaces
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate package.d.ts with namespace definition
 * @param {Object} packageInfo - Package information
 * @param {string} packageInfo.identifier - Package identifier
 * @param {Array} packageInfo.classes - Array of class objects with identifiers
 * @param {string} outputPath - Path to write the package.d.ts file
 */
function generatePackageDts(packageInfo, outputPath) {
    // Discover all classes in this package directory
    const allClasses = new Set();

    // Scan the package directory for all class subdirectories
    if (fs.existsSync(outputPath)) {
        const items = fs.readdirSync(outputPath);
        for (const item of items) {
            const itemPath = path.join(outputPath, item);
            const classJsonPath = path.join(itemPath, 'class.json');

            // Check if this is a class directory with class.json
            if (fs.existsSync(itemPath) && fs.statSync(itemPath).isDirectory() && fs.existsSync(classJsonPath)) {
                try {
                    const classData = JSON.parse(fs.readFileSync(classJsonPath, 'utf8'));
                    allClasses.add(classData.identifier);
                } catch (error) {
                    // Skip malformed class.json files
                }
            }
        }
    }

    // Add newly generated classes from packageInfo
    packageInfo.classes.forEach(cls => allClasses.add(cls.identifier));

    // Sort for consistent output
    const sortedClasses = Array.from(allClasses).sort();

    let pkgDtsContent = `/**
 * Auto-generated types for package ${packageInfo.identifier}
 */

`;

    const safePkgId = packageInfo.identifier.replace(/[^a-zA-Z0-9]/g, '_');

    pkgDtsContent += `declare interface I_Package_${safePkgId} {
`;
    pkgDtsContent += sortedClasses
        .map(identifier => `    ${identifier}: I_${identifier};`)
        .join('\n');
    pkgDtsContent += `
}
declare var ${packageInfo.identifier}: I_Package_${safePkgId};
`;

    const packageDtsPath = path.join(outputPath, 'package.d.ts');
    fs.writeFileSync(packageDtsPath, pkgDtsContent);
}

module.exports = {
    generatePackageDts
};
