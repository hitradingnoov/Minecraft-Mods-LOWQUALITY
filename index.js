const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL Bağlantı Havuzu (DATABASE_URL Vercel Environment Variables'dan alınır)
const pool = process.env.DATABASE_URL ? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
}) : null;

// Axios için standart Roblox istek yapılandırması (User-Agent zorunludur)
const robloxAxios = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Kod Üretme Endpoint'i
app.post('/api/generate-code', (req, res) => {
    try {
        const { username } = req.body || {};
        if (!username) {
            return res.status(400).json({ success: false, message: 'Kullanıcı adı gerekli!' });
        }
        
        const verificationCode = 'BLOX-' + Math.floor(1000 + Math.random() * 9000);
        return res.json({ success: true, code: verificationCode });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Sunucu içi hata!' });
    }
});

// 2. Bio Kontrol ve Giriş Endpoint'i
app.post('/api/verify-bio', async (req, res) => {
    try {
        const { username, expectedCode } = req.body || {};

        if (!username || !expectedCode) {
            return res.status(400).json({ success: false, message: 'Eksik parametre!' });
        }

        // Roblox Kullanıcı ID Bulma
        const userRes = await robloxAxios.post('https://users.roblox.com/v1/usernames/users', {
            usernames: [username]
        }).catch((err) => {
            console.error('Roblox Username API Hatası:', err.message);
            return null;
        });

        if (!userRes || !userRes.data || !userRes.data.data || userRes.data.data.length === 0) {
            return res.status(404).json({ success: false, message: 'Roblox kullanıcısı bulunamadı!' });
        }

        const userId = userRes.data.data[0].id;
        const displayName = userRes.data.data[0].name;

        // Roblox Bio Çekme
        const profileRes = await robloxAxios.get(`https://users.roblox.com/v1/users/${userId}`).catch((err) => {
            console.error('Roblox Profile API Hatası:', err.message);
            return null;
        });

        if (!profileRes || !profileRes.data) {
            return res.status(500).json({ success: false, message: 'Roblox profil verisi alınamadı.' });
        }

        const userBio = profileRes.data.description || "";

        if (userBio.includes(expectedCode)) {
            // Roblox Avatar Thumbnail Çekme
            let avatarUrl = 'https://tr.rbxcdn.com/30DAY-AvatarHeadshot-1-Png/150/150/AvatarHeadshot/Png';
            try {
                const thumbRes = await robloxAxios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
                if (thumbRes.data && thumbRes.data.data && thumbRes.data.data.length > 0) {
                    avatarUrl = thumbRes.data.data[0].imageUrl;
                }
            } catch (e) {
                console.error('Avatar resmi çekilemedi:', e.message);
            }

            let userBalance = 1000.00;

            // Eğer PostgreSQL bağlıysa veritabanına kaydet / bakiyeyi getir
            if (pool) {
                try {
                    const dbRes = await pool.query(
                        `INSERT INTO users (id, username, avatar, balance)
                         VALUES ($1, $2, $3, 1000.00)
                         ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, avatar = EXCLUDED.avatar
                         RETURNING balance;`,
                        [userId, displayName, avatarUrl]
                    );
                    if (dbRes.rows.length > 0) {
                        userBalance = parseFloat(dbRes.rows[0].balance);
                    }
                } catch (dbErr) {
                    console.error('DB Giriş Hatası:', dbErr.message);
                }
            }

            const userData = {
                id: userId,
                username: displayName,
                avatar: avatarUrl,
                balance: userBalance
            };

            res.cookie('user_session', JSON.stringify(userData), { 
                maxAge: 86400000, 
                httpOnly: false,
                sameSite: 'lax'
            });

            return res.json({ success: true, message: 'Giriş başarılı!', user: userData });
        } else {
            return res.status(400).json({ success: false, message: 'Doğrulama kodu profil açıklamanızda bulunamadı!' });
        }

    } catch (error) {
        console.error('Kritik Hata:', error.message);
        return res.status(500).json({ success: false, message: 'Sunucu hatası oluştu.' });
    }
});

// 3. Bakiye Sorgulama ve Güncelleme Endpoint'i
app.get('/api/user/balance', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ success: false, message: 'user_id gerekli!' });

    if (pool) {
        try {
            const result = await pool.query('SELECT balance FROM users WHERE id = $1', [user_id]);
            if (result.rows.length > 0) {
                return res.json({ success: true, balance: parseFloat(result.rows[0].balance) });
            }
        } catch (err) {
            console.error(err);
        }
    }
    return res.json({ success: true, balance: 1000.00 });
});

app.post('/api/user/balance', async (req, res) => {
    const { user_id, amount, type, game_name } = req.body;
    if (!user_id || amount === undefined) {
        return res.status(400).json({ success: false, message: 'Parametreler eksik!' });
    }

    if (pool) {
        try {
            const userRes = await pool.query('SELECT balance FROM users WHERE id = $1', [user_id]);
            if (userRes.rows.length > 0) {
                const currentBalance = parseFloat(userRes.rows[0].balance);
                const change = parseFloat(amount);
                if (change < 0 && currentBalance < Math.abs(change)) {
                    return res.status(400).json({ success: false, message: 'Yetersiz bakiye!' });
                }
                const newBalance = currentBalance + change;
                await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, user_id]);
                await pool.query(
                    'INSERT INTO transactions (user_id, type, amount, balance_after, game_name) VALUES ($1, $2, $3, $4, $5)',
                    [user_id, type || 'bet', change, newBalance, game_name || null]
                );
                return res.json({ success: true, new_balance: newBalance });
            }
        } catch (err) {
            console.error(err);
        }
    }

    return res.json({ success: true, new_balance: 1000.00 });
});

// Yerel çalıştırma ve Production (Vercel) ayrımı
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Lokal sunucu ${PORT} portunda aktif.`);
    });
}

module.exports = app;
