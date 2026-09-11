const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/buxify_db',
    // Supabase, Render veya Neon gibi bulut PostgreSQL servislerinde ssl gerekir:
    // ssl: { rejectUnauthorized: false }
});

module.exports = pool;
