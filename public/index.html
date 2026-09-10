const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public klasörünü dışa aç (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// Ana sayfa rotası
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Social Auth Redirect Rotaları (İleride OAuth2 logic eklenecek)
app.get('/auth/google', (req, res) => {
    res.send('Google Auth Yönlendirmesi Hazırlanıyor...');
});

app.get('/auth/discord', (req, res) => {
    res.send('Discord Auth Yönlendirmesi Hazırlanıyor...');
});

app.get('/auth/roblox', (req, res) => {
    res.send('Roblox Auth Yönlendirmesi Hazırlanıyor...');
});

// Yerel geliştirme sunucusu
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Buxify sunucusu http://localhost:${PORT} adresinde aktif!`);
    });
}

module.exports = app;
