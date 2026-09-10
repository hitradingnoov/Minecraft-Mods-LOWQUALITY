const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Kod Üretme
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

// 2. Bio Kontrol
app.post('/api/verify-bio', async (req, res) => {
    try {
        const { username, expectedCode } = req.body || {};

        if (!username || !expectedCode) {
            return res.status(400).json({ success: false, message: 'Eksik parametre!' });
        }

        // Roblox Kullanıcı ID Bulma
        const userRes = await axios.post('https://users.roblox.com/v1/usernames/users', {
            usernames: [username]
        }).catch(() => null);

        if (!userRes || !userRes.data || !userRes.data.data || userRes.data.data.length === 0) {
            return res.status(404).json({ success: false, message: 'Roblox kullanıcısı bulunamadı!' });
        }

        const userId = userRes.data.data[0].id;
        const displayName = userRes.data.data[0].name;

        // Roblox Bio Çekme
        const profileRes = await axios.get(`https://users.roblox.com/v1/users/${userId}`).catch(() => null);
        if (!profileRes || !profileRes.data) {
            return res.status(500).json({ success: false, message: 'Roblox profil verisi alınamadı.' });
        }

        const userBio = profileRes.data.description || "";

        if (userBio.includes(expectedCode)) {
            const avatarUrl = `https://tr.rbxcdn.com/30DAY-AvatarHeadshot-${userId}`;
            const userData = {
                id: userId,
                username: displayName,
                avatar: avatarUrl,
                balance: 1000.00
            };

            res.cookie('user_session', JSON.stringify(userData), { maxAge: 86400000 });
            return res.json({ success: true, message: 'Giriş başarılı!', user: userData });
        } else {
            return res.status(400).json({ success: false, message: 'Doğrulama kodu profil açıklamanızda bulunamadı!' });
        }

    } catch (error) {
        console.error('Kritik Hata:', error.message);
        return res.status(500).json({ success: false, message: 'Sunucu hatası oluştu.' });
    }
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda aktif.`);
    // Vercel Serverless Uyumlu Dışa Aktarım
module.exports = app;

if (process.env.NODE_ENV !== 'production') {
    app.listen(3000, () => {
        console.log('Lokal sunucu 3000 portunda çalışıyor...');
    });
}
});
