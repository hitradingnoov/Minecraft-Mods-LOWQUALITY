const express = require('express');
const path = require('path');
const axios = require('axios');
const config = require('./config');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- GOOGLE OAUTH2 ---
app.get('/auth/google', (req, res) => {
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${config.google.clientId}` +
        `&redirect_uri=${encodeURIComponent(config.google.callbackUrl)}` +
        `&response_type=code` +
        `&scope=email%20profile`;
    
    res.redirect(googleAuthUrl);
});

app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('Yetkilendirme kodu alınamadı.');

    try {
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: config.google.clientId,
            client_secret: config.google.clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: config.google.callbackUrl
        });

        const { access_token } = tokenResponse.data;
        const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        res.send(`Hoş geldin ${userResponse.data.name}! Google girişi başarılı.`);
    } catch (error) {
        console.error('Google OAuth Hatası:', error.response?.data || error.message);
        res.status(500).send('Google ile giriş hatası.');
    }
});

// --- ROBLOX OAUTH2 ---
app.get('/auth/roblox', (req, res) => {
    const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?` +
        `client_id=${config.roblox.clientId}` +
        `&redirect_uri=${encodeURIComponent(config.roblox.callbackUrl)}` +
        `&response_type=code` +
        `&scope=openid%20profile`;

    res.redirect(robloxAuthUrl);
});

app.get('/auth/roblox/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('Yetkilendirme kodu alınamadı.');

    try {
        const credentials = Buffer.from(`${config.roblox.clientId}:${config.roblox.clientSecret}`).toString('base64');
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: config.roblox.callbackUrl
        });

        const tokenResponse = await axios.post('https://apis.roblox.com/oauth/v1/token', params, {
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const userResponse = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        });

        res.send(`Hoş geldin ${userResponse.data.preferred_username || userResponse.data.name}! Roblox ID: ${userResponse.data.sub}`);
    } catch (error) {
        console.error('Roblox OAuth Hatası:', error.response?.data || error.message);
        res.status(500).send('Roblox ile giriş hatası.');
    }
});

// --- DISCORD OAUTH2 ---
app.get('/auth/discord', (req, res) => {
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?` +
        `client_id=${config.discord.clientId}` +
        `&redirect_uri=${encodeURIComponent(config.discord.callbackUrl)}` +
        `&response_type=code` +
        `&scope=identify%20email`;

    res.redirect(discordAuthUrl);
});

app.get('/auth/discord/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('Yetkilendirme kodu alınamadı.');

    try {
        const params = new URLSearchParams({
            client_id: config.discord.clientId,
            client_secret: config.discord.clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: config.discord.callbackUrl
        });

        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        });

        res.send(`Hoş geldin ${userResponse.data.username}! Discord girişi başarılı.`);
    } catch (error) {
        console.error('Discord OAuth Hatası:', error.response?.data || error.message);
        res.status(500).send('Discord ile giriş hatası.');
    }
});

// Yerel çalıştırma
if (process.env.NODE_ENV !== 'production') {
    const PORT = config.PORT || 3000;
    app.listen(PORT, () => console.log(`Sunucu http://localhost:${PORT} üzerinde çalışıyor.`));
}

module.exports = app;
