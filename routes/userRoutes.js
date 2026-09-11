const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Bakiye sorgula
router.get('/balance', userController.getBalance);

// Bakiye güncelle (Bahis/Kazanç)
router.post('/balance', userController.updateBalance);

// Profildeki "Recent Activity" verisini çek
router.get('/history', userController.getHistory);

module.exports = router;
