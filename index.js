const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const path = require('path');
const pool = require('./db'); // Veritabanı bağlantısı
const userRoutes = require('./routes/userRoutes'); // Bakiye & User Rotaları

const app = express();
const PORT = process.env.PORT || 3000;

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

// Bakiye ve Kullanıcı Rotalarını Bağlama (/api/user/balance vb.)
app.use('/api/user', userRoutes);

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
            let avatarUrl = 'https://tr.rbxcdn.com/30DAY-AvatarHeadshot-1-Png/150/150/AvatarHeadshot/Png'; // Varsayılan/Yedek görsel
            try {
                const thumbRes = await robloxAxios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
                if (thumbRes.data && thumbRes.data.data && thumbRes.data.data.length > 0) {
                    avatarUrl = thumbRes.data.data[0].imageUrl;
                }
            } catch (e) {
                console.error('Avatar resmi çekilemedi:', e.message);
            }

            // --- VERİTABANI İŞLEMİ (UPSERT) ---
            // Kullanıcı varsa bilgilerini güncelle, yoksa veritabanına yeni ekle
            let currentBalance = 0.00;
            try {
                const dbUser = await pool.query(
                    `INSERT INTO users (id, username, avatar, balance)
                     VALUES ($1, $2, $3, 0.00)
                     ON CONFLICT (id) 
                     DO UPDATE SET username = EXCLUDED.username, avatar = EXCLUDED.avatar
                     RETURNING balance;`,
                    [userId, displayName, avatarUrl]
                );
                currentBalance = parseFloat(dbUser.rows[0].balance);
            } catch (dbErr) {
                console.error('Veritabanı kayıt hatası:', dbErr);
            }

            const userData = {
                id: userId,
                username: displayName,
                avatar: avatarUrl,
                balance: currentBalance
            };

            res.cookie('user_session', JSON.stringify(userData), { 
                maxAge: 86400000, 
                httpOnly: false, // Frontend JS cookie'yi okuyabilsin diye
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

// Yerel çalıştırma ve Production (Vercel) ayrımı
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Lokal sunucu ${PORT} portunda aktif.`);
    });
}

module.exports = app;
