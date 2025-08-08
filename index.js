import { createFilteredFolder, isEmptyDirectory } from "./utils/directories_utilities.js";
import { decompressTarBz2File } from "./utils/extraction_utilities.js";
import scrapeMatchStats from "./lib/scrape_match_stats.js";
import enrichRecords from "./lib/enricher.js";
import { fileURLToPath } from "node:url";
import Server from "./lib/server.js";
import path from "node:path";

startScraper(dirname('data.tar.bz2'), dirname('.'));

/**
 * @param {string} tarFile 
 * @param {string} rootDir
 */
async function startScraper(tarFile, rootDir) {
    const extractedDir = await prepareDataDirectory(tarFile, rootDir,  { 
        removeCompressedFile: false,
        defaultDir: 'data' 
    });
    const dataDir = createFilteredFolder({
        neededFiles: [ 'composed.json', 'repaired.json' ], 
        targetDir: dirname('filtered_data_folder'), 
        sourceDir: extractedDir, 
        removeFilteredDir: true
    });
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
 *  defaultDir: string
 * }} [options={}] 
 * @returns 
 */
async function prepareDataDirectory(tarFile, dir, options = {}) {
    const { readdir } = await import('node:fs/promises');
    const dirContents = await readdir('./');
    const defaultDir = options.defaultDir;
        
    if (dirContents.includes(defaultDir) && !isEmptyDirectory(dirname(defaultDir))) {
        return dirname(defaultDir)
    }

    if (!tarFile && !dir) {
        throw new Error(`Neither a compressed file nor data directory is defined`);
    }

    if (!dir) {
        throw new Error(`Data directory must be defined`)
    }

    if (!tarFile && dir) {
        return dir
    }

    return decompressTarBz2File(tarFile, dir, !!options.removeCompressedFile)
}