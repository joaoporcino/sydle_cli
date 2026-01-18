/**
 * Core logic for fetching and processing Sydle classes
 * Shared by init, obterPacote, and obterClasse commands
 */

const { searchPaginated, get } = require('../api/main');
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

/**
 * Process classes from Sydle API and generate all necessary files
 * @param {Object} options - Processing options
 * @param {Object} options.query - Elasticsearch query to filter classes
 * @param {string} options.description - Description for logging (e.g., "Fetching package X")
 * @returns {Promise<Object>} Processing results
 */
async function processClasses(options) {
    const { query, description } = options;

    let url = process.env.SYDLE_API_URL;

    // Perform search and create folders
    console.log(description || 'Processing classes...');
    const classId = '000000000000000000000000';
    const classPakageId = '000000000000000000000015';

    console.log('Search query:', JSON.stringify(query, null, 2));
    let totalHits = 0;
    const packageInfoMap = new Map();

    // Phase 0: Load existing classes from previously downloaded packages
    const classIdToIdentifier = new Map();
    const allClassesData = [];

    console.log('Phase 0: Loading existing classes from other packages...');
    let env = 'prod';
    if (url.includes('dev')) env = 'dev';
    else if (url.includes('hom')) env = 'hom';
    const rootFolder = `sydle-${env}`;
    const rootPath = path.join(process.cwd(), rootFolder);

    if (fs.existsSync(rootPath)) {
        const loadClassesRecursively = (dir) => {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const itemPath = path.join(dir, item);
                const stat = fs.statSync(itemPath);

                if (stat.isDirectory()) {
                    // Check if this directory has a class.json
                    const classJsonPath = path.join(itemPath, 'class.json');
                    if (fs.existsSync(classJsonPath)) {
                        try {
                            const classData = JSON.parse(fs.readFileSync(classJsonPath, 'utf8'));
                            classIdToIdentifier.set(classData._id, classData.identifier);
                        } catch (error) {
                            // Silently skip malformed files
                        }
                    }
                    // Recursively check subdirectories
                    loadClassesRecursively(itemPath);
                }
            }
        };

        loadClassesRecursively(rootPath);
        console.log(`Loaded ${classIdToIdentifier.size} existing classes from other packages.`);
    }

    console.log('Phase 1: Collecting all classes...');
    await searchPaginated(classId, query, 50, async (hits) => {
        totalHits += hits.length;
        console.log(`Found ${hits.length} results in this batch (total: ${totalHits})`);
        for (const hit of hits) {
            console.log('Processing hit:', hit._id);
            if (hit._source && hit._source) {
                let _class = hit._source;
                // Fetch full class to ensure we have all details including scripts
                try {
                    _class = await get(classId, _class._id);
                } catch (error) {
                    console.error(`Failed to fetch full class ${_class._id}, using search result.`);
                }

                // Store in map for reference resolution
                classIdToIdentifier.set(_class._id, _class.identifier);
                allClassesData.push(_class);
            }
        }
    });

    console.log('Phase 2: Generating files for each class...');
    for (const _class of allClassesData) {
        console.log(`Generating files for class: ${_class.identifier}`);

        try {
            // Get package info
            let _pakage;
            try {
                _pakage = await get(classPakageId, _class.package._id);
            } catch (error) {
                console.error(`Failed to fetch package for class ${_class.identifier}`);
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
            console.error(`Error processing class ${_class.identifier}:`, error instanceof Error ? error.message : String(error));
        }
    }

    // Phase 3: Generate package.d.ts for each package
    console.log('Phase 3: Generating package.d.ts files...');
    for (const [packagePath, packageInfo] of packageInfoMap.entries()) {
        generatePackageDts(packageInfo, packagePath);
        console.log(`Generated package.d.ts in ${packagePath}`);
    }

    // Phase 4: Generate globals.d.ts, sydle.d.ts and sydleZod.js
    console.log('Phase 4: Generating globals.d.ts, sydle.d.ts and sydleZod.js...');
    generateGlobalsDts(rootPath);
    generateSydleDts(process.cwd());
    generateSydleZod(rootPath);
    generateAiDocs(process.cwd());

    console.log(`Search completed. Total hits processed: ${totalHits}`);
    console.log('Operation complete.');

    return {
        totalHits,
        packagesGenerated: packageInfoMap.size,
        classesGenerated: allClassesData.length
    };
}

module.exports = {
    processClasses
};
