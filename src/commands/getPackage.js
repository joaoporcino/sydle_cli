const { Command } = require('commander');
const { ensureAuth } = require('../utils/authFlow');
const { searchPaginated, get } = require('../api/main');
const { processClasses } = require('../core/processClasses');

const CLASS_METADATA_ID = '000000000000000000000000';

const obterPacoteCommand = new Command('obterPacote')
    .alias('getPackage')
    .description('Obter pacote do Sydle')
    .argument('<identifier>', 'Package identifier')
    .action(async (identifier) => {
        try {
            if (!(await ensureAuth())) {
                return;
            }

            console.log(`Fetching classes from package ${identifier}...`);

            // Query filtering by package identifier
            const query = {
                query: {
                    term: { "package.identifier.keyword": identifier }
                },
                sort: [{ "_id": "asc" }]
            };

            // Fetch classes from API
            const classesData = [];
            await searchPaginated(CLASS_METADATA_ID, query, 50, async (hits) => {
                console.log(`Found ${hits.length} classes in this batch...`);
                for (const hit of hits) {
                    if (hit._source) {
                        // Fetch full class to ensure we have all details including scripts
                        try {
                            const fullClass = await get(CLASS_METADATA_ID, hit._source._id);
                            classesData.push(fullClass);
                        } catch (error) {
                            console.error(`Failed to fetch class ${hit._source._id}, using search result.`);
                            classesData.push(hit._source);
                        }
                    }
                }
            });

            if (classesData.length === 0) {
                console.error(`No classes found in package '${identifier}'`);
                return;
            }

            console.log(`Total classes fetched: ${classesData.length}`);

            // Process all classes
            await processClasses(classesData, {
                description: `Processing package ${identifier}...`
            });

        } catch (error) {
            console.error('Error:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

module.exports = obterPacoteCommand;
