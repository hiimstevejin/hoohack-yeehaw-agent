import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
function parseEnvFile(contents) {
    const lines = contents.split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }
        const separatorIndex = line.indexOf('=');
        if (separatorIndex <= 0) {
            continue;
        }
        const key = line.slice(0, separatorIndex).trim();
        let value = line.slice(separatorIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!(key in process.env)) {
            process.env[key] = value;
        }
    }
}
export function loadVoiceAgentEnv() {
    const projectRoot = process.cwd();
    const candidatePaths = [
        path.join(projectRoot, '.env.local'),
        path.join(projectRoot, '.env'),
    ];
    for (const filePath of candidatePaths) {
        if (!existsSync(filePath)) {
            continue;
        }
        parseEnvFile(readFileSync(filePath, 'utf8'));
    }
}
