#!/usr/bin/env node
require('dotenv').config();
const { program } = require("commander");
const loginCommand = require('./src/commands/login');
const initCommand = require('./src/commands/init');
const mainCommand = require('./src/commands/main');
const obterPacoteCommand = require('./src/commands/obterPacote');
const obterClasseCommand = require('./src/commands/obterClasse');
const compareCommand = require('./src/commands/compare');
const watchCommand = require('./src/commands/watch');
const syncCommand = require('./src/commands/sync');
const obterInstanciaCommand = require('./src/commands/obterInstancia');

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
    .addCommand(obterInstanciaCommand);

program.parse();