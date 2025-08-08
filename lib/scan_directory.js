import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Recursively scans a directory and collects all composed.json and repaired.json files.
 * Returns a list of scrape targets with tournament, match data, and enriched file path.
 *
 * @param {string} rootDir - The root directory to scan
 * @returns {Promise<ScrapeTarget[]>}
 */
export default async function scanDirectory(rootDir) {
    /** @type {ScrapeTarget[]} */
    const targets = [];

    /** @param {string} dir */
    async function walk(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const hasRelevantJson = entries.some(entry =>
            entry.isFile() && ['composed.json', 'repaired.json'].includes(entry.name)
        );

        if (hasRelevantJson) {
            for (const entry of entries) {
                if (entry.isFile() && ['composed.json', 'repaired.json'].includes(entry.name)) {
                    const fullPath = path.join(dir, entry.name);
                    const baseName = entry.name.replace('.json', '');
                    const enrichedPath = path.join(dir, `${baseName}.enriched.json`);

                    try {
                        const content = await fs.readFile(fullPath, 'utf8');
                        const parsed = JSON.parse(content);

                        if (Array.isArray(parsed.data)) {
                            targets.push({
                                country: parsed.country,
                                tournament: parsed.tournament ?? 'Unknown Tournament',
                                matches: parsed.data,
                                savePath: enrichedPath,
                            });
                        }
                    } 
                    catch (err) {
                        console.warn(`⚠️ Failed to read or parse ${fullPath}: ${err.message}`);
                    }
                }
            }
        } 
        else {
            // Recurse into subdirectories
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    await walk(path.join(dir, entry.name));
                }
            }
        }
    }

    await walk(rootDir);
    return targets;
}

/**
 * @typedef {Object} Match
 * @property {string} date
 * @property {string} time
 * @property {string} homeTeam
 * @property {string} awayTeam
 * @property {string} score
 * @property {string} statsUrl
 * @property {Object} [stats]
 */

/**
 * @typedef {Object} Gameweek
 * @property {number} gameweek
 * @property {Match[]} matches
 */

/**
 * @typedef {Object} Season
 * @property {string} season
 * @property {Gameweek[]} gameweeks
 */

/**
 * @typedef {Object} ScrapeTarget
 * @property {string} country
 * @property {string} tournament
 * @property {Season[]} matches
 * @property {string} savePath
 */
