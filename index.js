#!/usr/bin/env node
require('dotenv').config();
const { program } = require("commander");
const loginCommand = require('./src/commands/login');
const initCommand = require('./src/commands/init');
const mainCommand = require('./src/commands/main');
const obterPacoteCommand = require('./src/commands/getPackage');
const obterClasseCommand = require('./src/commands/getClass');
const compareCommand = require('./src/commands/compare');
const watchCommand = require('./src/commands/watchClass');
const syncCommand = require('./src/commands/syncClass');
const createMethodCommand = require('./src/commands/createMethod');
const deleteMethodCommand = require('./src/commands/deleteMethod');
const obterInstanciaCommand = require('./src/commands/getInstance');
const createClassCommand = require('./src/commands/createClass');
const listInstanceCommand = require('./src/commands/listInstance');
const updateInstanceCommand = require('./src/commands/updateInstance');
const listProcessesCommand = require('./src/commands/listProcesses');
const getProcessCommand = require('./src/commands/getProcess');
const watchProcessCommand = require('./src/commands/watchProcess');

program
    .name("sydle")
    .version("0.0.1")
    .description("Sydle - The CLI for Sydle")
    .addCommand(initCommand)
    .addCommand(loginCommand)
    .addCommand(mainCommand)
    .addCommand(obterPacoteCommand)
    .addCommand(obterClasseCommand)
    .addCommand(compareCommand)
    .addCommand(watchCommand)
    .addCommand(syncCommand)
    .addCommand(createMethodCommand)
    .addCommand(deleteMethodCommand)
    .addCommand(obterInstanciaCommand)
    .addCommand(createClassCommand)
    .addCommand(listInstanceCommand)
    .addCommand(updateInstanceCommand)
    .addCommand(listProcessesCommand)
    .addCommand(getProcessCommand)
    .addCommand(watchProcessCommand);

program.parse();
