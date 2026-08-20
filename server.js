const express = require('express');
const path = require('path');
const { Telegraf } = require('telegraf');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Environment Variable ላይ ያለውን Token መጠቀም
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
    console.error('ERROR: BOT_TOKEN is not defined in environment variables!');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// /start
bot.start((ctx) => {
    ctx.reply('👋 እንኳን ወደ የቤተሰብ ቢንጎ በደህና መጡ! ለመጫወት ከታች ያለውን ቁልፍ ይጫኑ።', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🎮 Open Yohans Bingo Mini App', web_app: { url: 'https://yohans-vn77.onrender.com' } }]
            ]
        }
    });
});

// ቦቱን ማስነሳት
bot.launch().then(() => {
    console.log('✅ Telegram Bot successfully running...');
}).catch(err => {
    console.error('❌ Bot Launch Error:', err);
});

// APIs
let users = {};
const ROUND_TIME = 30; 
let startTime = Date.now();

function getRemainingTime() {
    let elapsed = Math.floor((Date.now() - startTime) / 1000);
    return ROUND_TIME - (elapsed % ROUND_TIME);
}

app.get('/api/game-status', (req, res) => {
    res.json({ remainingTime: getRemainingTime() });
});

app.get('/api/user-data/:userId', (req, res) => {
    const uid = req.params.userId;
    if (!users[uid]) users[uid] = { balance: 100 };
    res.json(users[uid]);
});

app.post('/api/play-card', (req, res) => {
    const { userId, stake } = req.body;
    if (!users[userId]) users[userId] = { balance: 100 };

    if (users[userId].balance < stake) {
        return res.json({ success: false, message: "በቂ ሂሳብ የለዎትም!" });
    }

    users[userId].balance -= stake;
    res.json({ success: true, newBalance: users[userId].balance });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
