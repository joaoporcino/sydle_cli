const { Command } = require('commander');
const { ensureAuth } = require('../utils/authFlow');
const { searchPaginated, get } = require('../api/main');
const { processClasses } = require('../core/processClasses');

const CLASS_METADATA_ID = '000000000000000000000000';

const obterClasseCommand = new Command('obterClasse')
    .alias('getClass')
    .description('Obter classe do Sydle')
    .argument('<identifier>', 'Class identifier')
    .action(async (identifier) => {
        try {
            if (!(await ensureAuth())) {
                return;
            }

            console.log(`Fetching class ${identifier}...`);

            // Query filtering by class identifier
            const query = {
                query: {
                    term: { "identifier.keyword": identifier }
                },
                sort: [{ "_id": "asc" }]
            };

            // Fetch class from API
            const classesData = [];
            await searchPaginated(CLASS_METADATA_ID, query, 50, async (hits) => {
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
                console.error(`Class '${identifier}' not found`);
                return;
            }

            console.log(`Found class: ${classesData[0].identifier}`);

            // Process the class
            await processClasses(classesData, {
                description: `Processing class ${identifier}...`
            });

        } catch (error) {
            console.error('Error:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

module.exports = obterClasseCommand;
