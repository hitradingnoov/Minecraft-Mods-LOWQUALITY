const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Rastgele Kod Üretme Endpoint'i
app.post('/api/generate-code', (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ success: false, message: 'Kullanıcı adı gerekli!' });
    }
    
    // Kullanıcıya özel rastgele 6 haneli doğrulama kodu üret (Örn: BLOX-8492)
    const verificationCode = 'BLOX-' + Math.floor(1000 + Math.random() * 9000);
    
    res.json({
        success: true,
        code: verificationCode
    });
});

// 2. Roblox Profil Açıklamasını (Bio) Kontrol Etme Endpoint'i
app.post('/api/verify-bio', async (req, res) => {
    const { username, expectedCode } = req.body;

    if (!username || !expectedCode) {
        return res.status(400).json({ success: false, message: 'Eksik parametre!' });
    }

    try {
        // A) Kullanıcı adından Roblox User ID'yi bul
        const userRes = await axios.post('https://users.roblox.com/v1/usernames/users', {
            usernames: [username]
        });

        if (!userRes.data.data || userRes.data.data.length === 0) {
            return res.status(404).json({ success: false, message: 'Roblox kullanıcısı bulunamadı!' });
        }

        const userId = userRes.data.data[0].id;
        const displayName = userRes.data.data[0].name;

        // B) Kullanıcının Profil Açıklamasını (Bio) Roblox API'sinden Çek
        const profileRes = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
        const userBio = profileRes.data.description || "";

        // C) Kod Profil Açıklamasında Var mı Kontrol Et
        if (userBio.includes(expectedCode)) {
            
            // Roblox Avatar Resmi Endpoint'i
            const avatarUrl = `https://tr.rbxcdn.com/30DAY-AvatarHeadshot-${userId}`;

            const userData = {
                id: userId,
                username: displayName,
                avatar: avatarUrl,
                balance: 1000.00 // İleride burayı MySQL/Database bağlayacağız
            };

            // Oturum Çerezini (Cookie) 24 saatliğine yaz
            res.cookie('user_session', JSON.stringify(userData), { maxAge: 86400000 });

            return res.json({
                success: true,
                message: 'Giriş başarılı!',
                user: userData
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Doğrulama kodu profil açıklamanızda bulunamadı! Lütfen kodu kaydedip tekrar deneyin.'
            });
        }

    } catch (error) {
        console.error('Roblox API Hatası:', error.message);
        res.status(500).json({ success: false, message: 'Roblox API bağlantı hatası oluştu.' });
    }
});

// Sunucuyu Başlat
app.listen(PORT, () => {
    console.log(`BloxGame sunucusu http://localhost:${PORT} üzerinde çalışıyor...`);
});
