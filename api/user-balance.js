fetch('/api/user-balance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        user_id: userId,
        amount: -50, // 50 BUX Düş (Bahis)
        type: 'bet',
        game_name: 'Mines'
    })
});
