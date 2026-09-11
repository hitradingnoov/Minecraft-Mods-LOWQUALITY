const MinesGame = {
    userId: null,
    isPlaying: false,

    init() {
        // Oturum açmış kullanıcının ID'sini cookie'den çek
        const cookies = document.cookie.split('; ');
        const userCookie = cookies.find(row => row.startsWith('user_session='));
        if (userCookie) {
            try {
                const userData = JSON.parse(decodeURIComponent(userCookie.split('=')[1]));
                this.userId = userData.id;
            } catch (e) {
                console.error("Kullanıcı ID okunamadı");
            }
        }

        this.renderGrid();
    },

    // 25 Kareli (5x5) Izgarayı Oluştur
    renderGrid() {
        const gridContainer = document.getElementById('mines-grid');
        if (!gridContainer) return;

        gridContainer.innerHTML = '';
        for (let i = 0; i < 25; i++) {
            const tile = document.createElement('button');
            tile.className = 'mines-tile bg-gray-800 hover:bg-gray-700 rounded-lg h-16 w-16 font-bold text-xl transition-all duration-150 flex items-center justify-center';
            tile.dataset.index = i;
            tile.disabled = true;
            tile.onclick = () => this.revealTile(i);
            gridContainer.appendChild(tile);
        }
    },

    // Oyunu Başlat
    async startGame() {
        if (!this.userId) return alert("Lütfen önce giriş yapın!");

        const betAmount = parseFloat(document.getElementById('mines-bet-amount').value);
        const minesCount = parseInt(document.getElementById('mines-count').value);

        const res = await fetch('/api/mines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'start',
                userId: this.userId,
                betAmount: betAmount,
                minesCount: minesCount
            })
        });

        const data = await res.json();

        if (data.success) {
            this.isPlaying = true;
            this.renderGrid();
            
            // Tüm kareleri aktif et
            document.querySelectorAll('.mines-tile').forEach(t => t.disabled = false);
            document.getElementById('btn-start-mines').classList.add('hidden');
            document.getElementById('btn-cashout-mines').classList.remove('hidden');
            document.getElementById('btn-cashout-mines').textContent = `Cashout (${data.nextMultiplier}x)`;

            // Bakiyeyi güncelle (BuxifyBalance helper script'i varsa)
            if (window.BuxifyBalance) {
                const bakiyeRes = await fetch('/api/user-balance?user_id=' + this.userId);
                const bakiyeData = await bakiyeRes.json();
                window.BuxifyBalance.updateUI(bakiyeData.balance);
            }
        } else {
            alert(data.message);
        }
    },

    // Kareye Basınca Çalışır
    async revealTile(tileIndex) {
        if (!this.isPlaying) return;

        const tileBtn = document.querySelector(`.mines-tile[data-index="${tileIndex}"]`);
        tileBtn.disabled = true;

        const res = await fetch('/api/mines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'reveal',
                userId: this.userId,
                tileIndex: tileIndex
            })
        });

        const data = await res.json();

        if (data.success) {
            if (data.isMine) {
                // KAYBETTİ (Mayına Bastı)
                tileBtn.classList.replace('bg-gray-800', 'bg-red-600');
                tileBtn.innerHTML = '💣';
                this.endGame(false, data.minePositions);
            } else {
                // GÜVENLİ KARE
                tileBtn.classList.replace('bg-gray-800', 'bg-green-600');
                tileBtn.innerHTML = '💎';
                
                document.getElementById('btn-cashout-mines').textContent = `Cashout (${data.currentPayout} BUX - ${data.nextMultiplier}x)`;

                if (data.isAutoWin) {
                    this.cashout();
                }
            }
        }
    },

    // Parayı Çek (Cashout)
    async cashout() {
        if (!this.isPlaying) return;

        const res = await fetch('/api/mines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'cashout',
                userId: this.userId
            })
        });

        const data = await res.json();

        if (data.success) {
            alert(`Tebrikler! ${data.winAmount} BUX Kazandınız! (${data.multiplier}x)`);
            this.endGame(true, data.minePositions);

            if (window.BuxifyBalance) {
                window.BuxifyBalance.updateUI(data.newBalance);
            }
        } else {
            alert(data.message);
        }
    },

    // Oyun Sonu
    endGame(isWin, minePositions) {
        this.isPlaying = false;
        document.querySelectorAll('.mines-tile').forEach(t => t.disabled = true);

        // Kalan Mayınları Göster
        if (minePositions) {
            minePositions.forEach(idx => {
                const btn = document.querySelector(`.mines-tile[data-index="${idx}"]`);
                if (!btn.classList.contains('bg-green-600') && !btn.classList.contains('bg-red-600')) {
                    btn.classList.replace('bg-gray-800', 'bg-gray-900');
                    btn.innerHTML = '💣';
                }
            });
        }

        document.getElementById('btn-start-mines').classList.remove('hidden');
        document.getElementById('btn-cashout-mines').classList.add('hidden');
    }
};

document.addEventListener('DOMContentLoaded', () => MinesGame.init());
