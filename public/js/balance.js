const BuxifyBalance = {
    // 1. Ekrandaki bakiye yazısını günceller
    updateUI(newBalance) {
        const balanceElements = document.querySelectorAll('#user-balance, .user-balance-val');
        balanceElements.forEach(el => {
            el.textContent = Number(newBalance).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        });

        // Cookie içerisindeki bakiyeyi de güncel tut
        const cookies = document.cookie.split('; ');
        const userCookie = cookies.find(row => row.startsWith('user_session='));
        if (userCookie) {
            try {
                const userData = JSON.parse(decodeURIComponent(userCookie.split('=')[1]));
                userData.balance = newBalance;
                document.cookie = `user_session=${encodeURIComponent(JSON.stringify(userData))}; path=/; max-age=86400`;
            } catch (e) {
                console.error("Cookie güncelleme hatası:", e);
            }
        }
    },

    // 2. Oyunda Bahis Miktarını Bakiyeden Düşer (Örn: Mines oyununda 'Play'e basılınca)
    async deductBet(userId, betAmount, gameName = 'Mines') {
        const amountToDeduct = -Math.abs(parseFloat(betAmount)); // Negatif sayıya dönüştürür

        try {
            const response = await fetch('/api/user-balance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    amount: amountToDeduct,
                    type: 'bet',
                    game_name: gameName
                })
            });

            const data = await response.json();

            if (data.success) {
                this.updateUI(data.new_balance);
                return { success: true, newBalance: data.new_balance };
            } else {
                alert(data.message || 'Bakiye düşülemedi!');
                return { success: false, message: data.message };
            }
        } catch (err) {
            console.error('Bahis düşme isteği hatası:', err);
            return { success: false, message: 'Bağlantı hatası!' };
        }
    },

    // 3. Oyun Kazandığında Bakiyeye Ekleme Yapar (Örn: Cashout yapıldığında)
    async addWin(userId, winAmount, gameName = 'Mines') {
        const amountToAdd = Math.abs(parseFloat(winAmount)); // Pozitif sayıya dönüştürür

        try {
            const response = await fetch('/api/user-balance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    amount: amountToAdd,
                    type: 'win',
                    game_name: gameName
                })
            });

            const data = await response.json();

            if (data.success) {
                this.updateUI(data.new_balance);
                return { success: true, newBalance: data.new_balance };
            }
        } catch (err) {
            console.error('Kazanç ekleme isteği hatası:', err);
        }
    }
};
