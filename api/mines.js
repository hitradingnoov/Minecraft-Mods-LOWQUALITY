const { Pool } = require('pg');

const pool = process.env.DATABASE_URL ? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
}) : null;

// Aktif oyunları geçici bellekte tutma (Vercel Serverless için state yönetimi)
global.activeMinesGames = global.activeMinesGames || {};

// Çarpan Hesaplama Fonksiyonu
function calculateMultiplier(minesCount, revealedCount) {
    const totalTiles = 25;
    let probability = 1;
    for (let i = 0; i < revealedCount; i++) {
        probability *= (totalTiles - minesCount - i) / (totalTiles - i);
    }
    const houseEdge = 0.95; // %5 Kasa Payı
    return parseFloat(((1 / probability) * houseEdge).toFixed(2));
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    const { action, userId, betAmount, minesCount, tileIndex } = req.body || {};

    if (!userId) return res.status(400).json({ success: false, message: 'userId gerekli.' });

    // -----------------------------------------------------------
    // ACTION 1: OYUNU BAŞLAT (START)
    // -----------------------------------------------------------
    if (action === 'start') {
        const bet = parseFloat(betAmount);
        const mines = parseInt(minesCount);

        if (isNaN(bet) || bet <= 0) return res.status(400).json({ success: false, message: 'Geçersiz bahis miktarı.' });
        if (isNaN(mines) || mines < 1 || mines > 24) return res.status(400).json({ success: false, message: 'Mayın sayısı 1-24 arasında olmalıdır.' });

        // 1. Veritabanından Bakiye Düşüşü
        if (pool) {
            try {
                const userRes = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
                if (userRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });

                const currentBalance = parseFloat(userRes.rows[0].balance);
                if (currentBalance < bet) {
                    return res.status(400).json({ success: false, message: 'Yetersiz bakiye!' });
                }

                const newBalance = currentBalance - bet;
                await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, userId]);
                await pool.query(
                    'INSERT INTO transactions (user_id, type, amount, balance_after, game_name) VALUES ($1, $2, $3, $4, $5)',
                    [userId, 'bet', -bet, newBalance, 'Mines']
                );
            } catch (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
            }
        }

        // 2. Mayınları Rastgele Yerleştir (25 kareden 'mines' kadarı mayın)
        const minePositions = new Set();
        while (minePositions.size < mines) {
            minePositions.add(Math.floor(Math.random() * 25));
        }

        // 3. Oyun Durumunu Kaydet
        global.activeMinesGames[userId] = {
            betAmount: bet,
            minesCount: mines,
            minePositions: Array.from(minePositions),
            revealedTiles: [],
            isGameOver: false
        };

        return res.json({ success: true, message: 'Oyun başladı!', nextMultiplier: calculateMultiplier(mines, 1) });
    }

    // -----------------------------------------------------------
    // ACTION 2: KARE AÇ (REVEAL)
    // -----------------------------------------------------------
    if (action === 'reveal') {
        const game = global.activeMinesGames[userId];
        if (!game || game.isGameOver) {
            return res.status(400).json({ success: false, message: 'Aktif bir oyun bulunamadı.' });
        }

        const idx = parseInt(tileIndex);
        if (isNaN(idx) || idx < 0 || idx > 24) return res.status(400).json({ success: false, message: 'Geçersiz kare.' });
        if (game.revealedTiles.includes(idx)) return res.status(400).json({ success: false, message: 'Bu kare zaten açıldı.' });

        // MAYINA BASTI MI?
        if (game.minePositions.includes(idx)) {
            game.isGameOver = true;
            const allMines = game.minePositions;
            delete global.activeMinesGames[userId];

            return res.json({
                success: true,
                isMine: true,
                gameOver: true,
                message: 'Mayına bastın! Oyun bitti.',
                minePositions: allMines
            });
        }

        // GÜVENLİ KARE
        game.revealedTiles.push(idx);
        const currentMultiplier = calculateMultiplier(game.minesCount, game.revealedTiles.length);
        const nextMultiplier = calculateMultiplier(game.minesCount, game.revealedTiles.length + 1);
        const currentPayout = parseFloat((game.betAmount * currentMultiplier).toFixed(2));

        // Bütün güvenli kareler açıldıysa otomatik kazandır
        const totalSafeTiles = 25 - game.minesCount;
        const isAutoWin = game.revealedTiles.length === totalSafeTiles;

        return res.json({
            success: true,
            isMine: false,
            revealedTile: idx,
            currentMultiplier: currentMultiplier,
            nextMultiplier: nextMultiplier,
            currentPayout: currentPayout,
            isAutoWin: isAutoWin,
            minePositions: isAutoWin ? game.minePositions : null
        });
    }

    // -----------------------------------------------------------
    // ACTION 3: PARAYI ÇEK (CASHOUT)
    // -----------------------------------------------------------
    if (action === 'cashout') {
        const game = global.activeMinesGames[userId];
        if (!game || game.isGameOver || game.revealedTiles.length === 0) {
            return res.status(400).json({ success: false, message: 'Çekilecek kazanç yok.' });
        }

        const multiplier = calculateMultiplier(game.minesCount, game.revealedTiles.length);
        const winAmount = parseFloat((game.betAmount * multiplier).toFixed(2));

        // Veritabanına Kazancı Ekle
        let newBalance = 0;
        if (pool) {
            try {
                const userRes = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
                const currentBalance = parseFloat(userRes.rows[0].balance);
                newBalance = currentBalance + winAmount;

                await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, userId]);
                await pool.query(
                    'INSERT INTO transactions (user_id, type, amount, balance_after, game_name) VALUES ($1, $2, $3, $4, $5)',
                    [userId, 'win', winAmount, newBalance, 'Mines']
                );
            } catch (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Kazanç aktarılamadı.' });
            }
        }

        const allMines = game.minePositions;
        delete global.activeMinesGames[userId];

        return res.json({
            success: true,
            message: 'Cashout başarılı!',
            winAmount: winAmount,
            multiplier: multiplier,
            newBalance: newBalance,
            minePositions: allMines
        });
    }

    return res.status(400).json({ success: false, message: 'Geçersiz işlem.' });
};
