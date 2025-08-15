import { saveJSON, sleep } from '../utils/utilities.js';
import { ProgressEmitter } from '../utils/utilities.js';
import scanDirectory from './scan_directory.js';
import fs from 'node:fs';

const processEvents = ['SIGINT', 'SIGTERM', 'uncaughtException', 'unhandledRejection'];

/**
 * Enriches matches with stats using the provided scraping function
 * @param {string} rootDir
 * @param {
 *  (score: string, url: string, options: { homeTeam: string, awayTeam: string }) => Promise<any>
 * } scrapeMatchStats
 * @param {{
 *  server?: Server, 
 *  delayMs?: number, 
 *  redoMarked?: boolean, 
 *  redoStats?: boolean
 * }} [options={}] 
 */
export default async function enrichRecords(rootDir, scrapeMatchStats, options = {}) {
    /** @type {Target[]} */
    let targets = await scanDirectory(rootDir);
    /** @type {Record<string, { match: Match, target: Target }[]>} */
    const matchesToEnrich = {};
    const progressEmitter = new ProgressEmitter();
    const progressReport = {};
    const missingData = [];
    const emptyUnits = {};
    const units = {};

    let currentProcessedUnitCounter = 0;
    let isEnrichmentCompleted = false;
    let lastProcessEventHandler;
    let lastProgressEvent;
    let totalMatches = 0;
    let totalUnits = 0;
    let completed = 0;
    
    targets = await checkScrapeProgress(rootDir, targets);
    
    // Group matches by unit (target)
    for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const unitList = [];
        const unitId = (() => {
            let timestamp = `${Date.now()}`;
            for (let j = 0; j < 6; j++) {
                if (!units[timestamp]) return timestamp;
                timestamp = `${Number(timestamp) + Math.ceil(Math.random() * 1500000)}`;
            }
            throw new Error('Failed to create unique timestamps');
        })();

        let unitCounter = 0;
        totalUnits = i + 1;
        
        for (const season of target.data) {
            if (Array.isArray(season.gameweeks) && season.gameweeks.length) {
                for (const gameweek of season.gameweeks) {
                    for (const match of gameweek.matches) {
                        const redoMarked = (
                            options.redoMarked && 
                            (match.stats === 'NO_STATS' || match.stats === 'NO_STATS_OTM')
                        );
                        if (match.statsUrl && (!match.stats || options.redoStats || redoMarked)) {
                            unitList.push({ match, target });
                            totalMatches++;
                            unitCounter++;
                        }
                    }
                }
            }
            else {
                missingData.push({ 
                    season: season.season, 
                    country: target.metadata.country, 
                    tournament: target.metadata.tournament
                })
            }
        }
        
        const unitIdentifier = `${target.metadata.tournament} (${target.metadata.country})`;

        if (unitList.length) {
            if (matchesToEnrich[unitId] || units[unitId]) {
                console.log('Potential duplicate data...');
                units[unitId]
                 ? console.log('Unit:', units[unitId]) 
                 : console.log('Matches to enrich:', matchesToEnrich[unitId]);
                // eslint-disable-next-line no-undef
                process.exit(1);
            }
            else {
                matchesToEnrich[unitId] = unitList;
                units[unitId] = { unitCounter, unitIdentifier };
            }
        }
        else {
            emptyUnits[unitId] = unitIdentifier;
        }
    }

    console.log(`✅ Total matches to enrich: ${totalMatches}`);
    console.log(`✅ Total of ${totalUnits} units processed`);
    console.log(`✅ Found a total of ${Object.keys(units).length} units to enrich`);
    
    if (missingData.length) {
        console.log(`✅ Found ${missingData.length} missed gameweeks units...`);
        missingData.forEach(d => console.log(` → Season: ${d.season} - ${d.tournament} (${d.country})`));
    }
    else {
        console.log('✅ There was no missing data');
    }

    const emptyUnitsLength = Object.keys(emptyUnits).length;
    if (emptyUnitsLength) {
        Object.keys(emptyUnits).forEach(u => {
            console.log(` → ${emptyUnits[u]} [Empty Unit]`);
        })
    }
    else {
        console.log('✅ There was no empty units');
    }

    console.log('\n');

    if (totalMatches && options.server) {
        options.server.enrichmentProgress(progressEmitter);
        options.server.stop();
        options.server.isLocalServer && !options.server.isRunning() && options.server.start();
    }

    for (const [unitId, unitList] of Object.entries(matchesToEnrich)) {
        if (unitList.length === 0) continue;
        const unit = units[unitId];
        const { target } = unitList[0]; // All matches in this unit have the same target
        currentProcessedUnitCounter++;

        const handleProcessExits = (events) => {
            for (const event of events) {
                // eslint-disable-next-line no-undef
                if (lastProcessEventHandler && process.listenerCount(event)) {
                    // eslint-disable-next-line no-undef
                    process.off(event, lastProcessEventHandler);
                }
            }

            lastProcessEventHandler = async () => {
                if (!isEnrichmentCompleted) {
                    saveProgress(target)
                }
            }

            for (const event of events) {
                // eslint-disable-next-line no-undef
                process.on(event, lastProcessEventHandler)
            }
        };
    
        handleProcessExits(processEvents);

        for (const { match } of unitList) {
            try {
                match.stats = await scrapeMatchStats(match.score, match.statsUrl, {
                    homeTeam: match.homeTeam,
                    awayTeam: match.awayTeam
                });
                await sleep(options.delayMs || Math.floor(Math.random() * 3000) + 1000); // 1–4s delay
            }

            catch (err) {
                console.warn(`⚠️ Failed to enrich: ${match.statsUrl} → ${err.message}`);
                match.stats = null;
            }

            finally {
                if (!progressReport[target.metadata.country]) {
                    progressReport[target.metadata.country] = {};
                }

                if (!progressReport[target.metadata.country][target.metadata.tournament]) {
                    progressReport.currentUnit = `${target.metadata.tournament} (${target.metadata.country})`;
                    progressReport.currentUnitCount = 1;
                    progressReport.progression = (
                        `${progressReport.currentUnitCount} of ${unit.unitCounter}`
                    );
                    progressReport.currentUnitPercentage = Math.floor(
                        (progressReport.currentUnitCount / unit.unitCounter) * 100
                    );
                    progressReport[target.metadata.country][target.metadata.tournament] = {};
                }

                else {
                    progressReport.currentUnitCount = progressReport.currentUnitCount + 1;
                    progressReport.progression = `${progressReport.currentUnitCount} of ${unit.unitCounter}`;
                    progressReport.currentUnitPercentage = Math.floor(
                        (progressReport.currentUnitCount / unit.unitCounter) * 100
                    );
                }

                if (match.stats) {
                    if (match.stats === 'NO_STATS' || match.stats === 'NO_STATS_OTM') {
                        let lastCount = progressReport[target.metadata.country][target.metadata.tournament].noStats;
                        !lastCount ? (lastCount = 1) : (lastCount = lastCount + 1);
                        progressReport[target.metadata.country][target.metadata.tournament].noStats = lastCount;
                        progressReport[target.metadata.country][target.metadata.tournament].noStatsPercentage = (
                            Math.floor((lastCount / unit.unitCounter) * 100)
                        );
                    }
                    else {
                        let lastCount = progressReport[target.metadata.country][target.metadata.tournament].foundStats;
                        !lastCount ? (lastCount = 1) : (lastCount = lastCount + 1);
                        progressReport[target.metadata.country][target.metadata.tournament].foundStats = lastCount;
                        progressReport[target.metadata.country][target.metadata.tournament].foundStatsPercentage = (
                            Math.floor((lastCount / unit.unitCounter) * 100)
                        );
                    }
                }
                else {
                    let lastCount = progressReport[target.metadata.country][target.metadata.tournament].erroneous;
                    !lastCount ? (lastCount = 1) : (lastCount = lastCount + 1);
                    progressReport[target.metadata.country][target.metadata.tournament].erroneous = lastCount;
                    progressReport[target.metadata.country][target.metadata.tournament].erroneousPercentage = (
                        Math.floor((lastCount / unit.unitCounter) * 100)
                    );
                }

                completed++;
    
                // ✅ Update shared progress object for API access
                lastProgressEvent = { 
                    percent: Number((completed / totalMatches) * 100).toFixed(2), 
                    currentProcessedUnitCounter,
                    total: totalMatches, 
                    isCompleted: false,
                    totalUnits,
                    completed, 
                    currentUnit: {
                        //currentUnit: progressReport.currentUnit, 
                        //currentUnitCount: progressReport.currentUnitCount, 
                        unitIdentifier: unit.unitIdentifier, 
                        percentage: progressReport.currentUnitPercentage,
                        progression: progressReport.progression
                    }
                };
                
                progressEmitter.sendProgress(lastProgressEvent);
            }
        }

        // Save after each unit
        const enriched = { 
            data: target.data, 
            metadata: Object.assign(target.metadata, { 
                enrichmentDatetime: new Date().toISOString(),
                enriched: true
            })
        };

        await saveJSON(target.savePath, enriched, `💾 Saved enriched file: ${target.savePath}`);
    }
    
    if (lastProgressEvent) {
        lastProgressEvent.isCompleted = true;
        progressEmitter.sendProgress(lastProgressEvent);
    }

    if (lastProcessEventHandler) {
        processEvents.forEach(evt => {
            // eslint-disable-next-line no-undef
            process.off(evt, lastProcessEventHandler)
        })
    }

    isEnrichmentCompleted = true;
}


function saveProgress(progress) {
    const filename = 'progress.json';
    const dirContents = fs.readdirSync('./');
    
    if (!dirContents.includes(filename) && progress) {
        const progressData = typeof progress === 'string'
         ? progress : JSON.stringify(progress, null, 2);
        fs.writeFileSync(`./${filename}`, progressData, 'utf8');
    }

    else {
        !progress
         ? console.log('Progress data is empty') 
         : console.log('Found progress file when saving progress');
    }

    // eslint-disable-next-line no-undef
    process.exit(0);
}

async function checkScrapeProgress(rootDir, targets) {
    const filename = 'progress.json';
    const progressData = (() => {
        const dirContents = fs.readdirSync('./');
        if (!dirContents.includes(filename)) return null;
        return JSON.parse(fs.readFileSync(`./${filename}`, 'utf8'))
    })();

    if (!progressData) return targets;

    console.log('✅ Found progression...');
    console.log(` → Progressing from ${progressData.metadata.country} (${progressData.metadata.tournament})\n`);

    /** [TODO] - Do more robust checking to verify data integrity before writing to a file */
    const filepath = progressData.savePath.replace('.enriched', '');
    const data = { metadata: progressData.metadata, data: progressData.data };
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync(filepath, jsonData, 'utf8');

    if (progressData) {
        fs.unlinkSync(`./${filename}`)
    }

    return scanDirectory(rootDir)
}

/**
 * @typedef {Object} Match
 * @property {string} statsUrl
 * @property {object|null} stats
 * @property {string} homeTeam
 * @property {string} awayTeam
 * @property {string} score
 */

/**
 * @typedef {Object} Gameweek
 * @property {Match[]} matches
 */

/**
 * @typedef {Object} Season
 * @property {Gameweek[]} gameweeks
 */

/**
 * @typedef {Object} Target
 * @property {Season[]} data
 * @property {string} savePath
 * @property {{
 *  scrapeDate: string, 
 *  country: string, 
 *  tournament: string
 * }} metadata
 */
