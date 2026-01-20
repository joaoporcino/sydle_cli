/**
 * Core logic for processing Sydle classes
 * Shared by init, obterPacote, obterClasse and criarClasse commands
 * 
 * Receives an array of class objects and generates all necessary files.
 */

const { get } = require('../api/main');
const fs = require('fs');
const path = require('path');
const {
    generateClassDts,
    generateClassSchema,
    generateFieldsSchema,
    generateSydleZod,
    generateMethodFiles,
    generatePackageDts,
    generateGlobalsDts,
    generateSydleDts,
    generateAiDocs
} = require('../generators');
const { logger } = require('../utils/logger');

/**
 * Process an array of classes and generate all necessary files
 * @param {Object[]} classesData - Array of class objects to process
 * @param {Object} [options] - Processing options
 * @param {string} [options.description] - Description for logging
 * @returns {Promise<Object>} Processing results
 */
async function processClasses(classesData, options = {}) {
    const { description } = options;

    logger.info(description || 'Processing classes...');

    const classId = '000000000000000000000000';
    const classPakageId = '000000000000000000000015';

    let url = process.env.SYDLE_API_URL;
    let env = 'prod';
    if (url.includes('dev')) env = 'dev';
    else if (url.includes('hom')) env = 'hom';
    const rootFolder = `sydle-${env}`;
    const rootPath = path.join(process.cwd(), rootFolder);

    // Ensure root folder exists
    if (!fs.existsSync(rootPath)) {
        fs.mkdirSync(rootPath, { recursive: true });
    }

    const packageInfoMap = new Map();

    // Phase 0: Load existing classes from previously downloaded packages
    const classIdToIdentifier = new Map();

    logger.info('Phase 0: Loading existing classes from other packages...');
    if (fs.existsSync(rootPath)) {
        const loadClassesRecursively = (dir) => {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const itemPath = path.join(dir, item);
                const stat = fs.statSync(itemPath);

                if (stat.isDirectory()) {
                    const classJsonPath = path.join(itemPath, 'class.json');
                    if (fs.existsSync(classJsonPath)) {
                        try {
                            const classData = JSON.parse(fs.readFileSync(classJsonPath, 'utf8'));
                            classIdToIdentifier.set(classData._id, classData.identifier);
                        } catch (error) {
                            // Silently skip malformed files
                        }
                    }
                    loadClassesRecursively(itemPath);
                }
            }
        };

        loadClassesRecursively(rootPath);
        logger.debug(`Loaded ${classIdToIdentifier.size} existing classes from other packages.`);
    }

    // Add new classes to the map
    for (const _class of classesData) {
        if (_class._id && _class.identifier) {
            classIdToIdentifier.set(_class._id, _class.identifier);
        }
    }

    logger.info(`Phase 1: Processing ${classesData.length} classes...`);
    for (const _class of classesData) {
        logger.progress(`Generating files for class: ${_class.identifier}`);

        try {
            // Get package info
            let _pakage;
            try {
                _pakage = await get(classPakageId, _class.package._id);
            } catch (error) {
                logger.error(`Failed to fetch package for class ${_class.identifier}`);
                continue;
            }

            const packagePath = path.join(rootPath, _pakage.identifier);
            if (!fs.existsSync(packagePath)) {
                fs.mkdirSync(packagePath, { recursive: true });
            }
            fs.writeFileSync(path.join(packagePath, 'package.json'), JSON.stringify(_pakage, null, 2));

            const classPath = path.join(packagePath, _class.identifier);
            if (!fs.existsSync(classPath)) {
                fs.mkdirSync(classPath, { recursive: true });
            }
            fs.writeFileSync(path.join(classPath, 'class.json'), JSON.stringify(_class, null, 2));

            const methods = (_class.methods || []);

            // Generate method files using generator
            generateMethodFiles(classPath, methods, rootPath, classIdToIdentifier, _class);

            // Generate class.d.ts and class.schema.js using generators
            await generateClassDts(_class, classPath, { classIdToIdentifier, classId });
            generateClassSchema(_class, classPath);
            generateFieldsSchema(_class, classPath, rootPath);

            // Collect info for package.d.ts
            if (!packageInfoMap.has(packagePath)) {
                packageInfoMap.set(packagePath, {
                    identifier: _pakage.identifier,
                    classes: []
                });
            }
            packageInfoMap.get(packagePath).classes.push({
                identifier: _class.identifier
            });
        } catch (error) {
            logger.error(`Error processing class ${_class.identifier}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // Phase 2: Generate package.d.ts for each package
    logger.info('Phase 2: Generating package.d.ts files...');
    for (const [packagePath, packageInfo] of packageInfoMap.entries()) {
        generatePackageDts(packageInfo, packagePath);
        logger.debug(`Generated package.d.ts in ${packagePath}`);
    }

    // Phase 3: Generate globals.d.ts, sydle.d.ts and sydleZod.js
    logger.info('Phase 3: Generating globals.d.ts, sydle.d.ts and sydleZod.js...');
    generateGlobalsDts(rootPath);
    generateSydleDts(process.cwd());
    generateSydleZod(rootPath);
    generateAiDocs(process.cwd());

    logger.success(`Processing completed. Total classes processed: ${classesData.length}`);
    logger.success('Operation complete.');

    return {
        packagesGenerated: packageInfoMap.size,
        classesGenerated: classesData.length
    };
}

module.exports = {
    processClasses
};
