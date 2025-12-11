#!/usr/bin/env node
require('dotenv').config();
const { program } = require("commander");
const loginCommand = require('./src/commands/login');
const initCommand = require('./src/commands/init');
const mainCommand = require('./src/commands/main');
const obterPacoteCommand = require('./src/commands/obterPacote');

program
    .name("sydle")
    .version("0.0.1")
    .description("Sydle - The CLI for Sydle")
    .addCommand(initCommand)
    .addCommand(loginCommand)
    .addCommand(mainCommand)
    .addCommand(obterPacoteCommand);

program.parse();