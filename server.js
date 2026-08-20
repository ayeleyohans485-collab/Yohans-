const express = require('express');
const path = require('path');
const { Telegraf } = require('telegraf');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

let users = {};
let currentDrawnNumbers = [];
let gameInterval = null;

// በየ 3 ሰከንዱ ቁጥር የሚያወጣ ሰርቨር
function startNumberDrawer() {
    if (gameInterval) clearInterval(gameInterval);
    currentDrawnNumbers = [];
    
    gameInterval = setInterval(() => {
        if (currentDrawnNumbers.length < 75) {
            let num;
            do {
                num = Math.floor(Math.random() * 75) + 1;
            } while (currentDrawnNumbers.includes(num));
            
            currentDrawnNumbers.push(num);
        } else {
            clearInterval(gameInterval);
        }
    }, 3000);
}

startNumberDrawer();

// Telegram Bot Command
bot.start((ctx) => {
    const uid = ctx.from.id.toString();
    if (!users[uid]) users[uid] = { balance: 10 };

    ctx.reply('👋 እንኳን ወደ የቤተሰብ 5x5 ቢንጎ በደህና መጡ! 10 ETB የነጻ ቦነስ ተሰጥቶዎታል። ለመጫወት ከታች ያለውን ቁልፍ ይጫኑ።', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🎮 Open Yohans Bingo Mini App', web_app: { url: 'https://yohans-vn77.onrender.com' } }]
            ]
        }
    });
});

bot.launch();

// APIs
app.get('/api/game-state', (req, res) => {
    res.json({ drawnNumbers: currentDrawnNumbers });
});

app.get('/api/user-data/:userId', (req, res) => {
    const uid = req.params.userId;
    if (!users[uid]) users[uid] = { balance: 10 };
    res.json(users[uid]);
});

app.post('/api/claim-bingo', (req, res) => {
    const { userId, stake, cardCount } = req.body;
    if (!users[userId]) users[userId] = { balance: 10 };

    // አሸናፊውን ብር ማሳደግ (Stake * 3)
    const winAmount = stake * 3 * cardCount;
    users[userId].balance += winAmount;

    // አዲስ የቁጥር ማውጣት ዙር ማስጀመር
    startNumberDrawer();

    res.json({ success: true, newBalance: users[userId].balance, winAmount });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
