import cliProgress from 'cli-progress';
import { normalizeFilepath, saveJSON, sleep } from '../utils/utilities.js';
import scanDirectory from './scan_directory.js';


/**
 * Enriches matches with stats using the provided scraping function
 * @param {string} rootDir
 * @param {
 *  (score: string, url: string, options: { homeTeam: string, awayTeam: string }) => Promise<any>
 * } scrapeMatchStats
 * @param {{
 *  server?: Server, 
 *  delayMs?: number
 * }} [options={}] 
 */
export default async function enrichRecords(rootDir, scrapeMatchStats, options = {}) {
    /** @type {Target[]} */
    const targets = await scanDirectory(rootDir);
    /** @type {Record<string, { match: Match, target: Target }[]>} */
    const matchesToEnrich = {};
        
    const delayMs = options.delayMs || Math.floor(Math.random() * 2000) + 1000; // 1–3s delay
    const progressEmitter = new ProgressEvent();
    const units = new Map();
    let lastProgressEvent;
    let totalMatches = 0;
    let unitCounter = 1;
    let completed = 0;

    // Group matches by unit (target)
    for (const target of targets) {
        // unitId is not filepath normalizeFilepath is used merely to remove spaces
        const unitId = normalizeFilepath(`${target.country}-${target.tournament}-${Date.now()}}`);
        const unitList = [];

        for (const season of target.matches) {
            for (const gameweek of season.gameweeks) {
                for (const match of gameweek.matches) {
                    if (match.statsUrl && !match.stats) {
                        unitList.push({ match, target });
                        totalMatches++;
                    }
                }
            }
        }

        if (unitList.length > 0) {
            matchesToEnrich[unitId] = unitList;
            units.set(unitId, { unitCounter, unitIdentifier: `${target.tournament} (${target.country})`});
            unitCounter++;
        }
    }

    console.log(`✅ Total matches to enrich: ${totalMatches}`);
    console.log(`✅ A total of ${units.size} units to enrich\n`);

    if (totalMatches && options.server) {
        options.server.enrichmentProgress(progressEmitter);
        options.server.stop();
    }

    const progress = new cliProgress.SingleBar({
        format: 'Progress |{bar}| {percentage}% || {value}/{total} matches || ETA: {eta_formatted}',
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);

    progress.start(totalMatches, 0);

    for (const [unitId, unitList] of Object.entries(matchesToEnrich)) {
        if (unitList.length === 0) continue;
        const { target } = unitList[0]; // All matches in this unit have the same target

        for (const { match } of unitList) {
            try {
                match.stats = await scrapeMatchStats(match.score, match.statsUrl, {
                    homeTeam: match.homeTeam,
                    awayTeam: match.awayTeam
                });
            } 
            catch (err) {
                console.warn(`⚠️ Failed to enrich: ${match.statsUrl} → ${err.message}`);
                match.stats = null;
            }

            progress.increment();
            completed++;

            // ✅ Update shared progress object for API access
            const unit = units.get(unitId);
            lastProgressEvent = { 
                percent: Number(Number((completed / totalMatches) * 100).toFixed(2)), 
                unitIdentifier: unit.unitIdentifier,
                currentUnit: unit.unitCounter,
                totalUnits: unit.size,
                currentUnitId: unitId,
                total: totalMatches, 
                isCompleted: false,
                completed
            };
            
            progressEmitter.sendProgress(lastProgressEvent);
            await sleep(delayMs);
        }

        // Save after each unit
        const enriched = {
            country: target.country,
            tournament: target.tournament,
            data: target.matches
        };

        await saveJSON(target.savePath, enriched, `💾 Saved enriched file: ${target.savePath}`);
    }

    progress.stop();
    
    if (lastProgressEvent) {
        lastProgressEvent.isCompleted = true;
        progressEmitter.sendProgress(lastProgressEvent);
    }
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
 * @property {string} country
 * @property {string} tournament
 * @property {string} savePath
 * @property {Season[]} matches
 */
