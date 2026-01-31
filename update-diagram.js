#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { get } = require('./src/api/main');

const PROCESS_DIAGRAM_CLASS_ID = '595c20500000000000000120';
const DIAGRAM_ID = '697e19b5d7ee9e1cb6043991';
const DIAGRAM_PATH = './sydle-process-dev/testes/teste_cli_sydle/1_1/diagram/diagram.json';

async function updateLocalDiagram() {
    try {
        console.log('📥 Fetching clean diagram from server...');
        const diagram = await get(PROCESS_DIAGRAM_CLASS_ID, DIAGRAM_ID);

        console.log('💾 Saving to local diagram.json...');
        fs.writeFileSync(DIAGRAM_PATH, JSON.stringify(diagram, null, 2), 'utf-8');

        console.log('✅ Local diagram.json updated successfully!');
        console.log(`Subprocesses count: ${diagram.subprocesses?.length || 0}`);
        console.log(`Tasks count: ${diagram.tasks?.length || 0}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

updateLocalDiagram();
