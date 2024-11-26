import fs from 'fs'
import path, {dirname} from 'path'
import {SourceMapConsumer} from "source-map"
import clipboard from 'clipboardy'

import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const readFileAsync = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) reject(err)
            else resolve(data)
        })
    })
}

const unminifyStackTrace = async (sourceMapsDirectory) => {
    const stackTraceContent = await clipboard.read()
    const files = fs.readdirSync(sourceMapsDirectory)
    const sourceMaps = {}

    // Load all source maps
    for (const file of files) {
        if (file.endsWith('.map')) {
            const mapContent = await readFileAsync(path.join(sourceMapsDirectory, file))
            sourceMaps[file.replace('.map', '')] = await new SourceMapConsumer(JSON.parse(mapContent))
        }
    }

    // Replace minified positions in stack trace
    const originalStackTrace = stackTraceContent.replace(
        /at\s+(.+)\s+\((.+\.js):(\d+):(\d+)\)/g,
        (match, functionName, filePath, line, column) => {
            const sourceMap = sourceMaps[path.basename(filePath)];
            if (sourceMap) {
                const pos = sourceMap.originalPositionFor({
                    line: parseInt(line, 10),
                    column: parseInt(column, 10),
                });

                if (pos.source) {
                    const sourceFunctionName = pos.name || functionName
                    return `at ${sourceFunctionName} (${pos.source}:${pos.line}:${pos.column})`;
                }
            }
            return match;
        }
    );

    Object.values(sourceMaps).forEach(map => map.destroy())

    return originalStackTrace
};

const main = async (sourceMapsDirectory) => {
    if (!sourceMapsDirectory) {
        console.error('Usage: npx deobf <sourceMapsDirectory>')
        process.exit(1)
    }

    const unminifiedStackTrace = await unminifyStackTrace(
        path.resolve(__dirname, sourceMapsDirectory)
    )

    console.log('Unminified Stack Trace:\n')
    console.log(unminifiedStackTrace)
}

// Get input arguments
const [, , sourceMapsDirectory, stackTraceFilePath] = process.argv

main(sourceMapsDirectory, stackTraceFilePath).catch(err => console.error('Error during unminification:', err))