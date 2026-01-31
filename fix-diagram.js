#!/usr/bin/env node
require('dotenv').config();
const { patch, get } = require('./src/api/main');

const PROCESS_DIAGRAM_CLASS_ID = '595c20500000000000000120';
const DIAGRAM_ID = '697e19b5d7ee9e1cb6043991';

async function fixDiagram() {
    try {
        console.log('📋 Fetching current diagram...');
        const diagram = await get(PROCESS_DIAGRAM_CLASS_ID, DIAGRAM_ID);

        console.log(`Current subprocesses count: ${diagram.subprocesses?.length || 0}`);

        if (diagram.subprocesses && diagram.subprocesses.length > 0) {
            const taskIndex = diagram.subprocesses.findIndex(
                item => item.identifier === 'userTask697e19bde2c9ff47aa000001'
            );

            if (taskIndex !== -1) {
                console.log(`✓ Found task at subprocesses[${taskIndex}]`);
                console.log('🔧 Removing task from subprocesses...');

                await patch(PROCESS_DIAGRAM_CLASS_ID, {
                    _id: DIAGRAM_ID,
                    _operationsList: [{
                        op: 'remove',
                        path: `/subprocesses/${taskIndex}`
                    }]
                });

                console.log('✅ Successfully removed task from subprocesses!');
                console.log('💡 Now you can sync normally.');
            } else {
                console.log('⚠️  Task not found in subprocesses array');
            }
        } else {
            console.log('⚠️  No subprocesses in diagram');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

fixDiagram();
