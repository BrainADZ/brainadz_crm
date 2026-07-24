const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'src');
const extensions = ['', '.js', '.jsx', '.css', '.json'];
const importPattern =
  /(?:import\s+(?:[^'"]+\s+from\s+)?|export\s+[^'"]+\s+from\s+|import\s*\()\s*['"]([^'"]+)['"]/g;

const walkFiles = (directory) => {
  const files = [];

  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
      return;
    }

    if (/\.(js|jsx)$/.test(entry.name)) {
      files.push(entryPath);
    }
  });

  return files;
};

const pathExistsWithExactCase = (absolutePath) => {
  const relativePath = path.relative(rootDir, absolutePath);
  if (!relativePath || relativePath.startsWith('..')) return false;

  let currentDirectory = rootDir;
  return relativePath.split(path.sep).every((segment) => {
    const entries = fs.readdirSync(currentDirectory);
    if (!entries.includes(segment)) return false;
    currentDirectory = path.join(currentDirectory, segment);
    return true;
  });
};

const resolveImport = (fromFile, specifier) => {
  const basePath = path.resolve(path.dirname(fromFile), specifier);
  const candidates = extensions.map((extension) => `${basePath}${extension}`);

  candidates.push(path.join(basePath, 'index.js'), path.join(basePath, 'index.jsx'));

  return candidates.find(pathExistsWithExactCase);
};

const errors = [];

walkFiles(sourceDir).forEach((filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativeFile = path.relative(rootDir, filePath).replace(/\\/g, '/');
  let match;

  while ((match = importPattern.exec(content))) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;

    if (!resolveImport(filePath, specifier)) {
      errors.push(`${relativeFile} -> ${specifier}`);
    }
  }
});

if (errors.length) {
  console.error('Import path casing or file resolution issues found:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('All relative import paths match exact file casing.');
