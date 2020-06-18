#!/usr/bin/env node
const _ = require('lodash');
const fs = require('fs-extra');
const yargs = require('yargs');
const { changeFileExtension, yearRange } = require('./lib/utils');
const { FIELDS, addDataField } = require('./lib/dataFields');
const ieee = require('./lib/ieeeAPI');
const { fromResults: json2xls } = require('./lib/json2xls');

const { APIKEY } = process.env;

const { argv } = yargs
  .wrap(null)
  .version(require('../package').version)
  .usage('Usage: $0 <query> [options] [IEEE Data Fields]')
  .strict()
  .alias('help', 'h')
  .demandCommand(1, 1, 'No search query specified')
  .option('output', {
    alias: 'o',
    describe: 'Filename where to save results as JSON',
    nargs: 1,
    type: 'string',
    demandOption: true,
  })
  .option('full-text-and-metadata', {
    alias: 'f',
    conflicts: ['text-only', 'publication-title', 'metadata', 'ieee-terms'],
    describe: 'Searches for "Full Text & Metadata"',
    type: 'boolean',
  })
  .option('text-only', {
    alias: 't',
    conflicts: ['full-text-and-metadata', 'publication-title', 'metadata', 'ieee-terms'],
    describe: 'Searches for "Full Text Only"',
    type: 'boolean',
  })
  .option('publication-title', {
    alias: 'p',
    conflicts: ['text-only', 'full-text-and-metadata', 'metadata', 'ieee-terms'],
    describe: 'Searches for "Publication Title"',
    type: 'boolean',
  })
  .option('metadata', {
    alias: 'm',
    describe: 'Searches for "All Metadata"',
    conflicts: ['text-only', 'full-text-and-metadata', 'publication-title', 'ieee-terms'],
    type: 'boolean',
  })
  .option('ieee-terms', {
    alias: 'i',
    describe: 'Searches for "IEEE Terms"',
    conflicts: ['text-only', 'full-text-and-metadata', 'publication-title', 'metadata'],
    type: 'boolean',
  })
  .option('excel', {
    alias: 'e',
    describe: 'Whether to also save results as excel file in addition to JSON',
    default: false,
    type: 'boolean',
  })
  .option('year', {
    alias: 'y',
    nargs: 1,
    demandOption: true,
    describe: 'Year range to search. A single value will search from "year" to date',
    type: 'number',
  })
  .option('api', {
    alias: 'a',
    describe: 'Whether to use the IEEE API or scrapping',
    default: false,
    type: 'boolean',
  })
  .option('verbose', {
    alias: 'v',
    describe: 'Show extra info',
    type: 'boolean',
  })
  .parserConfiguration({
    'strip-aliased': true,
    'strip-dashed': true,
  })
  .check((args) => {
    if (args.year.length > 2) throw new Error('Only start and/or finish year are accepted');
    if (Array.isArray(args.year)) {
      args.year.forEach((year) => {
        if (!Number.isInteger(year)) throw new Error('Year has to be a integer');
        if (year.toString().length !== 4) throw new Error('Year has to be a 4 digit integer');
        if (year < 1900 || year > new Date().getFullYear()) {
          throw new Error('Year has to be after 1900 and before current one');
        }
      });
    } else {
      if (!Number.isInteger(args.year)) throw new Error('Year has to be a integer');
      if (args.year.toString().length !== 4) throw new Error('Year has to be a 4 digit integer');
      if (args.year < 1900 || args.year > new Date().getFullYear()) {
        throw new Error('Year has to be after 1900 and before current one');
      }
    }
    if (args.api && !APIKEY) throw new Error('No APIKEY key provided. Set APIKEY enviroment variable');
    return true;
  })
  .group(['full-text-and-metadata', 'text-only', 'publication-title', 'metadata', 'ieee-terms'], 'IEEE Data Fields')
  .example(
    '$0 "optics AND nano" -o search1 -y 1990 -y 2000 -e',
    'searches for "optics AND nano" between 1990-2000 and save the results in search1.json and search1.xls',
  )
  .example(
    '$0 "h264 NEAR/3 cellular" -y 2005 -o search2.json',
    'searches for "h264 NEAR/3 cellular" from 2005 to date, and save the results in search2.json',
  );

// Selects the enabled key of the specified data field. _.pick is faster than _.omit
const dataField = Object.keys(_.pick(argv, Object.keys(FIELDS)))[0];
// Transform the year into an array if only one was specified
const rangeYear = yearRange(argv.year);

console.log('Searching for: %s', argv._[0]);
console.log('Between %s and %s', rangeYear[0], rangeYear[1]);
console.log('Using: %s', FIELDS[dataField] || 'No data fields');

async function search() {
  const results = argv.api
    ? await ieee.api(APIKEY, addDataField(argv._[0], FIELDS[dataField]), rangeYear, argv.verbose)
    : await ieee.scrap(addDataField(argv._[0], FIELDS[dataField]), rangeYear, argv.verbose);

  console.log('Found %s results', results.total_records);
  if (argv.api && results.total_records > 200) {
    console.warn('WARNING: API searches are limited to fetching 200 results');
    console.warn('\t Consider using scraping or narrowing your search');
  }
  if (results.total_records > 0) {
    try {
      await fs.ensureFile(changeFileExtension(argv.output, '.json')); // create the parent directory if they don't exist
      await fs.writeJson(changeFileExtension(argv.output, '.json'), results.articles, { spaces: 1 });
    } catch (error) {
      console.error(`Error writing JSON file:\n${error}`);
      process.exit(6);
    }
    if (argv.excel) json2xls(results.articles, changeFileExtension(argv.output, '.xls'));
  }
}
search();
