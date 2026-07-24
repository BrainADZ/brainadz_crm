// Create a file named generateSecret.js

const crypto = require('crypto');

// Generate a random 256-bit (32-byte) secret key
const secretKey = crypto.randomBytes(256).toString('bussinesskaro');

console.log('JWT Secret Key:', secretKey);
