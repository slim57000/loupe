const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

process.env.TRUST_PROXY = 'loopback, linklocal, uniquelocal';

const { app } = require('../proxy/server');

test('le proxy de confiance vient de TRUST_PROXY', () => {
  assert.equal(app.get('trust proxy'), 'loopback, linklocal, uniquelocal');
});

test('sans TRUST_PROXY, seule la boucle locale est approuvée', () => {
  const script = "process.env.TRUST_PROXY='';const {app}=require('./proxy/server');process.stdout.write(String(app.get('trust proxy')))";
  const output = execFileSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8'
  });
  assert.equal(output, 'loopback');
});
