import fs from 'node:fs';
import path from 'node:path';

const parseEnvLine = (line: string): [string, string] | undefined => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return undefined;
  }
  const separator = trimmed.indexOf('=');
  if (separator <= 0) {
    return undefined;
  }
  const key = trimmed.slice(0, separator).trim();
  const rawValue = trimmed.slice(separator + 1).trim();
  const value =
    (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ? rawValue.slice(1, -1)
      : rawValue;
  return [key, value];
};

const applyEnvFile = (filePath: string): void => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  fs.readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .map(parseEnvLine)
    .filter((entry): entry is [string, string] => Boolean(entry))
    .forEach(([key, value]) => {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
};

export const loadEnvFile = (filePath?: string): void => {
  const candidates = filePath
    ? [filePath]
    : [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '..', '.env'),
        path.resolve(__dirname, '..', '..', '..', '..', '.env'),
        path.resolve(__dirname, '..', '..', '..', '..', '..', '.env'),
      ];

  [...new Set(candidates)].forEach(applyEnvFile);
};
