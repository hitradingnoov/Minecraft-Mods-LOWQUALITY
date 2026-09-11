const pool = require('../db');

// 1. Kullanıcı Bakiyesini Getir
exports.getBalance = async (req, res) => {
    const { user_id } = req.query;

    if (!user_id) {
        return res.status(400).json({ success: false, message: 'user_id parametresi eksik.' });
    }

    try {
        const result = await pool.query(
            'SELECT balance, wager, wins FROM users WHERE id = $1',
            [user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        const user = result.rows[0];
        return res.json({
            success: true,
            balance: parseFloat(user.balance),
            wager: parseFloat(user.wager),
            wins: parseFloat(user.wins)
        });
    } catch (err) {
        console.error('getBalance Hatası:', err);
        return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
    }
};

// 2. Bakiye Güncelle (Bahis Oynama / Kazanç / Bonus Yükleme)
exports.updateBalance = async (req, res) => {
    const { user_id, amount, type, game_name } = req.body;

    if (!user_id || amount === undefined || !type) {
        return res.status(400).json({ success: false, message: 'Eksik parametreler.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // SQL İşlemini başlat

        // Eşzamanlı işlemlerde çakışmayı önlemek için satırı kilitliyoruz (FOR UPDATE)
        const userRes = await client.query(
            'SELECT balance, wager, wins FROM users WHERE id = $1 FOR UPDATE',
            [user_id]
        );

        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        const currentBalance = parseFloat(userRes.rows[0].balance);
        let wager = parseFloat(userRes.rows[0].wager);
        let wins = parseFloat(userRes.rows[0].wins);
        const changeAmount = parseFloat(amount);

        // Yetersiz Bakiye Kontrolü
        if (changeAmount < 0 && currentBalance < Math.abs(changeAmount)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Yetersiz bakiye!' });
        }

        const newBalance = currentBalance + changeAmount;

        // Wager ve Win güncellemeleri
        if (type === 'bet') {
            wager += Math.abs(changeAmount);
        } else if (type === 'win') {
            wins += changeAmount;
        }

        // 1. Users tablosunu güncelle
        await client.query(
            'UPDATE users SET balance = $1, wager = $2, wins = $3 WHERE id = $4',
            [newBalance, wager, wins, user_id]
        );

        // 2. Transactions geçmişine ekle
        await client.query(
            'INSERT INTO transactions (user_id, type, amount, balance_after, game_name) VALUES ($1, $2, $3, $4, $5)',
            [user_id, type, changeAmount, newBalance, game_name || null]
        );

        await client.query('COMMIT'); // Tüm işlemleri kaydet

        return res.json({
            success: true,
            new_balance: newBalance,
            wager: wager,
            wins: wins
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('updateBalance Hatası:', err);
        return res.status(500).json({ success: false, message: 'İşlem gerçekleştirilemedi.' });
    } finally {
        client.release();
    }
};

// 3. Kullanıcının Son İşlem ve Oyun Geçmişini Getir
exports.getHistory = async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ success: false, message: 'userId parametresi eksik.' });
    }

    try {
        const result = await pool.query(
            `SELECT type, amount, balance_after, game_name AS "gameName", created_at 
             FROM transactions 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT 10`,
            [userId]
        );

        return res.json({
            success: true,
            history: result.rows
        });
    } catch (err) {
        console.error('getHistory Hatası:', err);
        return res.status(500).json({ success: false, message: 'Görünüm verisi çekilemedi.' });
    }
};
