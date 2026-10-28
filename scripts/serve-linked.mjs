#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const defaultTargetPath = '/Users/atamrawi/git/AI-Enabled-Software-Engineering';
const targetArg = process.argv.slice(2).find(arg => !arg.startsWith('-'));
const targetPath = path.resolve(process.env.LINKED_DOCS_PATH || targetArg || defaultTargetPath);
const linkName = path.basename(targetPath);
const linkPath = path.join(rootDir, linkName);
const gitignorePath = path.join(rootDir, '.gitignore');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node scripts/serve-linked.mjs [path-to-folder] [options]

Arguments:
  path-to-folder   Optional folder path to link (default: ${defaultTargetPath})

Options:
  --clean, --unlink  Remove the existing symlink and exit
  --help, -h         Show this help message

Environment variables:
  LINKED_DOCS_PATH              Custom directory to link
  MARKDOWN_VIEWER_TEST_PORT     Custom port (default: 4173)
`);
  process.exit(0);
}

if (process.argv.includes('--clean') || process.argv.includes('--unlink')) {
  try {
    const stats = fs.lstatSync(linkPath);
    if (stats.isSymbolicLink()) {
      fs.unlinkSync(linkPath);
      console.log(`🧹 Removed symlink: ${linkName}`);
    } else {
      console.log(`"${linkName}" is not a symbolic link; left unchanged.`);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`No symlink found at "${linkName}".`);
    } else {
      console.error(`Error removing symlink: ${err.message}`);
    }
  }
  process.exit(0);
}

// 1. Ensure target entry is in .gitignore without trailing slash so git ignores the symlink
function ensureGitignore(entry) {
  if (!fs.existsSync(gitignorePath)) return;
  const content = fs.readFileSync(gitignorePath, 'utf8');
  const lines = content.split('\n').map(l => l.trim());
  if (!lines.includes(entry)) {
    const trailingNewline = content.endsWith('\n') ? '' : '\n';
    fs.appendFileSync(gitignorePath, `${trailingNewline}${entry}\n`, 'utf8');
    console.log(`📄 Added "${entry}" to .gitignore`);
  }
}

// 2. Ensure symlink exists and points to target
function ensureSymlink() {
  let stats;
  try {
    stats = fs.lstatSync(linkPath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  if (stats) {
    if (stats.isSymbolicLink()) {
      const currentTarget = fs.readlinkSync(linkPath);
      if (path.resolve(rootDir, currentTarget) === targetPath) {
        console.log(`🔗 Symlink active: ${linkName} -> ${targetPath}`);
        return;
      }
      console.log(`🔄 Updating symlink: ${linkName} (was -> ${currentTarget})`);
      fs.unlinkSync(linkPath);
    } else {
      console.warn(`⚠️ Warning: "${linkPath}" exists and is not a symlink. Please remove or rename it first.`);
      return;
    }
  }

  try {
    fs.symlinkSync(targetPath, linkPath, 'dir');
    console.log(`🔗 Created symlink: ${linkName} -> ${targetPath}`);
  } catch (err) {
    console.error(`❌ Failed to create symlink: ${err.message}`);
    process.exit(1);
  }
}

ensureGitignore(linkName);
ensureSymlink();

function findSampleMarkdownFiles(dir) {
  const samples = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
        samples.push(e.name);
      }
    }
    // Also check for lecture overview
    const lectureSample = path.join('lectures', '00-course-overview', 'lessons', '00-course-overview.md');
    if (fs.existsSync(path.join(dir, lectureSample))) {
      samples.push(lectureSample);
    }
  } catch (_) {}
  return samples.length ? samples : ['README.md'];
}

const sampleDocs = findSampleMarkdownFiles(targetPath);
const primarySample = sampleDocs[0];
const lectureSample = sampleDocs.find(s => s.includes('00-course-overview')) || primarySample;

const host = '127.0.0.1';
const port = Number(process.env.MARKDOWN_VIEWER_TEST_PORT || 4173);

console.log('\n============================================================');
console.log(' Markdown Viewer — Local Document Server');
console.log('============================================================');
console.log(`📁 Source Folder: ${targetPath}`);
console.log(`🔗 Linked As:     ./${linkName}`);
console.log(`🌐 Server URL:    http://${host}:${port}/`);
console.log('\n📖 Example test URLs for Read-Only URL mode:');
console.log(`  👉 Course Overview Lecture:`);
console.log(`     http://${host}:${port}/?url=http://${host}:${port}/${linkName}/${lectureSample}`);
console.log(`  👉 Slide Presentation Mode:`);
console.log(`     http://${host}:${port}/?url=http://${host}:${port}/${linkName}/${lectureSample}&slides=1`);
console.log(`  👉 Root File (${primarySample}):`);
console.log(`     http://${host}:${port}/?url=http://${host}:${port}/${linkName}/${primarySample}`);
console.log(`  👉 Dark Theme + Wide Reader:`);
console.log(`     http://${host}:${port}/?url=http://${host}:${port}/${linkName}/${lectureSample}&theme=dark&width=wide`);
console.log('\n(Note: Files inside subdirectories must include their exact folder path, e.g. /lessons/)');
console.log('Press Ctrl+C to stop the server.\n============================================================\n');

// Start the static server
await import('../tests/helpers/static-server.mjs');
