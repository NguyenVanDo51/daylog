const { Pool } = require('pg');
require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';
const pool = new Pool({
  connectionString: isTest ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL,
});

module.exports = { pool };
