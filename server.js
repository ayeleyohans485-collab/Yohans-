const express = require('express');
const path = require('path');
const { Telegraf } = require('telegraf');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

// የተጫዋቾች መረጃ እና የሰርቨር ገቢ (House Revenue)
let users = {};
let houseProfit = 0; // የ 20% ኮሚሽን ሳጥን

// Global Game State (ሁሉም 200+ ተጫዋቾች በአንድ ላይ የሚጫወቱበት)
let currentDrawnNumbers = [];
let gameInterval = null;

// በየ 3 ሰከንዱ ቁጥር የሚያወጣ ማዕከላዊ ሰርቨር
function startGlobalGame() {
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
            // 75 ቁጥሮች ወጥተው ካለቁ አዲስ ዙር በራሱ ይጀምራል
            startGlobalGame();
        }
    }, 3000);
}

// ጨዋታውን ማስነሳት
startGlobalGame();

// Telegram Bot Command
bot.start((ctx) => {
    const uid = ctx.from.id.toString();
    if (!users[uid]) users[uid] = { balance: 10 };

    ctx.reply('👋 እንኳን ወደ የቤተሰብ 5x5 ቢንጎ በደህና መጡ! 10 ETB ቦነስ ተሰጥቶዎታል። ለመጫወት ከታች ያለውን ቁልፍ ይጫኑ።', {
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

// አሸናፊ ሲኖር BINGO ሲል
app.post('/api/claim-bingo', (req, res) => {
    const { userId, stake, cardCount } = req.body;
    if (!users[userId]) users[userId] = { balance: 10 };

    const totalStake = stake * cardCount;

    if (users[userId].balance < totalStake) {
        return res.json({ success: false, message: "በቂ ሂሳብ የለዎትም!" });
    }

    // 1. የ 20% ኮሚሽን ስሌት (House cut 20%)
    const commission = totalStake * 0.20;
    const winAmount = (totalStake * 3) - commission; // አሸናፊው 20% ተቀንሶበት ያገኛል

    houseProfit += commission; // 20% ወደ ባለቤቱ ሒሳብ ገቢ ይሆናል
    users[userId].balance += winAmount;

    // አዲሱን ዙር ለሁሉም ተጫዋቾች ማስነሳት
    startGlobalGame();

    res.json({ 
        success: true, 
        newBalance: users[userId].balance, 
        winAmount: winAmount,
        houseProfit: houseProfit 
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
