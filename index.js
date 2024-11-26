#!/usr/bin/env node
'use strict';
const fs = require('fs/promises')
const path = require('path')
const clipboard = require('clipboardy');
const {SourceMapConsumer} = require('source-map');

const unminifyStackTrace = async (sourceMapsDirectory) => {
    const stackTraceContent = await clipboard.read()
    const files = await fs.readdir(sourceMapsDirectory)
    const sourceMaps = {}

    // Load all source maps
    for (const file of files) {
        if (file.endsWith('.map')) {
            const mapContent = await fs.readFile(path.join(sourceMapsDirectory, file), 'utf-8');
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

    console.log(unminifiedStackTrace)
}

// Get input arguments
const [, , sourceMapsDirectory] = process.argv

main(sourceMapsDirectory).catch(err => console.error('Error during unminification:', err))
