#!/usr/bin/env node
const crypto = require('crypto');

console.log('--- Aagara Thirupthi Generated Secrets ---');
console.log('JWT_ACCESS_SECRET=' + crypto.randomBytes(36).toString('hex'));
console.log('JWT_REFRESH_SECRET=' + crypto.randomBytes(36).toString('hex'));
console.log('DOC_ENCRYPTION_KEY=' + crypto.randomBytes(32).toString('base64'));
console.log('-----------------------------------------');
