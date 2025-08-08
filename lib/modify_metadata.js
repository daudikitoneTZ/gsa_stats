import fs from "node:fs";
import path from "node:path";

/**
 * Rewrites meta data to standard format on need files or defaults to composed.json
 * and repaired.json files. Standard format is { scrapeDate, tournament, country }
 * @param {string} root 
 * @param {Array<string>} neededFiles 
 */
export default async function rewriteMetaData(root, neededFiles = []) {
    const { readdir } = await import('fs/promises');
    const dirContents = await readdir(root);
    for (const dir of dirContents) {
        const pathname = path.join(root, dir);
        const metadata = readMetaData(pathname);
        const files = neededFiles.length
         ? neededFiles 
         : [ 'composed.json', 'repaired.json' ];
        traverse(pathname, metadata, files);
    }
}

function traverse(dir, metadata, neededFiles = [], folders = [], files = []) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((file) => {
        const pathname = path.join(dir, file.name);
        file.isDirectory() && !folders.includes(pathname) && folders.push(pathname);
        file.isFile() && neededFiles.includes(file.name) && !files.includes(pathname) && files.push(pathname);
    });
    
    if (folders.length) {
        return traverse(folders.shift(), metadata, neededFiles, folders, files);
    }
    
    if (files.length) {
        for (const file of files) {
            try {
                const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (parsed.metadata) continue; // Skip if it's in standard format

                const tournament = parsed.tournament;
                const md = {
                    scrapeDate: metadata.scrapeDate || new Date().toISOString(), 
                    country: metadata.country, 
                    tournament
                };
                const matches = parsed.data;
                const data = { metadata: md, data: matches };
                fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
                console.log(`Country: ${metadata.country}, tournament: ${md.tournament}`);
            } 
            catch (error) {
                console.log(`File error occured: ${error.message}`)
            }
        }
    }
}

function readMetaData(dir) {
    const metadata = {};
    try {
        const contents = fs.readFileSync(path.join(dir, 'metadata.txt'), 'utf8');
        for (const c of contents.split('\n')) {
            const [k, v] = c.split('=');
            const key = typeof k === 'string' && k.toLowerCase().trim();
            key === 'tournament' && (metadata.tournament = v.trim());
            key === 'country' && (metadata.country = v.trim());
            key === 'date' && (metadata.scrapeDate = v.trim());
        }
        return metadata
    }   
    catch(error) {
        console.warn(`Error occurred when reading metadata:`, error.message);
        return metadata
    }
}