const { Command } = require('commander');
const { ensureAuth } = require('../utils/authFlow');
const { searchPaginated, get } = require('../api/main');
const { processClasses } = require('../core/processClasses');

const CLASS_METADATA_ID = '000000000000000000000000';

const initCommand = new Command('iniciar')
    .alias('init')
    .description('Initialize the Sydle environment with all classes from Sydle')
    .action(async () => {
        try {
            if (!(await ensureAuth())) {
                return;
            }

            console.log('Fetching all classes from Sydle...');

            // Query to fetch ALL classes
            const query = {
                query: { match_all: {} },
                sort: [{ "_id": "asc" }]
            };

            // Fetch all classes from API
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

            console.log(`Total classes fetched: ${classesData.length}`);

            // Process all classes
            await processClasses(classesData, {
                description: 'Processing all classes and creating folders...'
            });

        } catch (error) {
            console.error('Error:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

module.exports = initCommand;
