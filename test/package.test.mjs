import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

test('package is configured for the correct public repository', () => {
  assert.notEqual(pkg.private, true);
  assert.equal(pkg.name, 'jev-readability');
  assert.equal(pkg.publishConfig.access, 'public');
  assert.equal(pkg.repository.url, 'git+https://github.com/hifizz/jev-readability.git');
});
test('all advertised ESM and declaration entrypoints exist', async () => {
  for (const entry of Object.values(pkg.exports)) {
    await access(new URL(entry.import, root));
    await access(new URL(entry.types, root));
    assert.ok(await import(new URL(entry.import, root).href));
  }
});
test('CLI has an executable shebang and is included in package files', async () => {
  assert.ok((await readFile(new URL(pkg.bin['jev-readability'], root), 'utf8')).startsWith('#!/usr/bin/env node\n'));
  assert.ok(pkg.files.includes('examples/extract-file.mjs'));
});
test('publish allowlist excludes secrets and generated test data', () => {
  assert.ok(!pkg.files.includes('.'));
  assert.ok(!pkg.files.some(path => /^\.env|^\.npmrc$|^node_modules|^test-artifacts/.test(path)));
  assert.ok(pkg.scripts.prepublishOnly.includes('npm test'));
});
