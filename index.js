import { createFilteredFolder, isEmptyDirectory } from "./utils/directories_utilities.js";
import { decompressTarBz2File } from "./utils/extraction_utilities.js";
import scrapeMatchStats from "./lib/scrape_match_stats.js";
import enrichRecords from "./lib/enricher.js";
import { fileURLToPath } from "node:url";
import Server from "./lib/server.js";
import path from "node:path";

// Starting the program
startScraper(dirname('data.tar.bz2'), dirname('.'));

//const stats = await scrapeMatchStats("2 : 0", 'https://globalsportsarchive.com/match/soccer/2024-08-17/arsenal-fc-vs-wolverhampton-wanderers-fc/3356599/', {
//    homeTeam: 'Arsenal FC', awayTeam: 'Wolverhampton Wanderers FC'
//});
//console.log('Stats:', stats);

/**
 * @param {string} tarFile 
 * @param {string} rootDir
 */
async function startScraper(tarFile, rootDir) {
    let dataDir = '';
    const { extractedDir, isDefault } = await prepareDataDirectory(tarFile, rootDir,  { 
        newDirName: dirname(`${Date.now()}`),
        removeCompressedFile: false,
        defaultDir: 'data' 
    });

    if (isDefault) (dataDir = extractedDir);
    else {
        dataDir = await createFilteredFolder({
            neededFiles: [ 'composed.json', 'repaired.json' ], 
            targetDir: dirname('data'), 
            sourceDir: extractedDir, 
            removeFilteredDir: true
        });
    }
        
    const server = new Server({ port: 9090 });
    server.start();
    await enrichRecords(dataDir, scrapeMatchStats, { server });
}

/** @param {string} filepath */
function dirname(filepath) {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    return filepath === '.' || filepath === './'
     ? dir : path.join(dir, filepath);
}

/**
 * @param {string} tarFile
 * @param {string} dir
 * @param {{
 *  removeCompressedFile: boolean,
 *  newDirName: string,
 *  defaultDir: string
 * }} [options={}] 
 * @returns {Promise<{ extractedDir: string, isDefault: boolean }>}
 */
async function prepareDataDirectory(tarFile, dir, options = {}) {
    const { readdir } = await import('node:fs/promises');
    const dirContents = await readdir('./');
    const defaultDir = options.defaultDir;
    
    if (dirContents.includes(defaultDir) && !isEmptyDirectory(dirname(defaultDir))) {
        return { extractedDir: dirname(defaultDir), isDefault: true }
    }

    if (!tarFile && !dir) {
        throw new Error(`Neither a compressed file nor data directory is defined`);
    }

    if (!dir) {
        throw new Error(`Data directory must be defined`)
    }

    if (!tarFile && dir) {
        return { extractedDir: dir, isDefault: true }
    }

    const dataDir = await decompressTarBz2File(tarFile, dir, {
        removeTarFile: !!options.removeCompressedFile, 
        renameTo: options.newDirName
    });

    return { extractedDir: dataDir, isDefault: false }
}