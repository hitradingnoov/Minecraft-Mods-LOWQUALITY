const { Pool } = require('pg');

// Vercel PostgreSQL Bağlantı Havuzu
const pool = process.env.DATABASE_URL ? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
}) : null;

module.exports = async (req, res) => {
    // CORS Başlıkları
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 1. GET: Bakiyeyi Sorgula (/api/user-balance?user_id=123)
    if (req.method === 'GET') {
        const { user_id } = req.query;
        if (!user_id) {
            return res.status(400).json({ success: false, message: 'user_id parametresi gerekli.' });
        }

        if (pool) {
            try {
                const result = await pool.query('SELECT balance FROM users WHERE id = $1', [user_id]);
                if (result.rows.length > 0) {
                    return res.json({ success: true, balance: parseFloat(result.rows[0].balance) });
                }
            } catch (err) {
                console.error('Bakiye çekme hatası:', err);
            }
        }
        return res.json({ success: true, balance: 1000.00 });
    }

    // 2. POST: Bakiyeden Düş / Kazanç Ekle (/api/user-balance)
    if (req.method === 'POST') {
        const { user_id, amount, type, game_name } = req.body || {};

        if (!user_id || amount === undefined) {
            return res.status(400).json({ success: false, message: 'Eksik parametreler.' });
        }

        const changeAmount = parseFloat(amount); // Negatif ise düşer (bahis), pozitif ise ekler (kazanç)

        if (pool) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN'); // SQL İşlemini başlat

                // Çakışmaları önlemek için satırı kilitleyerek bakiyeyi çek
                const userRes = await client.query(
                    'SELECT balance, wager, wins FROM users WHERE id = $1 FOR UPDATE',
                    [user_id]
                );

                if (userRes.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
                }

                const currentBalance = parseFloat(userRes.rows[0].balance);
                let wager = parseFloat(userRes.rows[0].wager || 0);
                let wins = parseFloat(userRes.rows[0].wins || 0);

                // Yetersiz Bakiye Kontrolü (Bahis miktarının bakiyeden büyük olup olmadığını denetle)
                if (changeAmount < 0 && currentBalance < Math.abs(changeAmount)) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ success: false, message: 'Yetersiz bakiye!' });
                }

                const newBalance = currentBalance + changeAmount;

                if (type === 'bet') {
                    wager += Math.abs(changeAmount);
                } else if (type === 'win') {
                    wins += changeAmount;
                }

                // 1. Users tablosundaki bakiyeyi ve istatistikleri güncelle
                await client.query(
                    'UPDATE users SET balance = $1, wager = $2, wins = $3 WHERE id = $4',
                    [newBalance, wager, wins, user_id]
                );

                // 2. Transactions tablosuna işlem geçmişini kaydet
                await client.query(
                    'INSERT INTO transactions (user_id, type, amount, balance_after, game_name) VALUES ($1, $2, $3, $4, $5)',
                    [user_id, type || 'bet', changeAmount, newBalance, game_name || null]
                );

                await client.query('COMMIT');

                return res.json({
                    success: true,
                    new_balance: newBalance,
                    wager: wager,
                    wins: wins
                });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error('Bakiye güncelleme hatası:', err);
                return res.status(500).json({ success: false, message: 'İşlem başarısız.' });
            } finally {
                client.release();
            }
        }

        // DB Bağlantısı yoksa fallback (lokal test modunda geçici yanıt)
        return res.json({ success: true, new_balance: 1000.00 });
    }

    return res.status(405).json({ message: 'Method Not Allowed' });
};
