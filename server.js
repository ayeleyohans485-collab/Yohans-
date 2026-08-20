const express = require('express');
const path = require('path');
const { Telegraf } = require('telegraf');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

let users = {};
let houseProfit = 0;

let gameState = 'WAITING';
let countdown = 30;
let currentDrawnNumbers = [];
let takenCards = {};

let gameTimer = null;
let drawTimer = null;

// ትክክለኛውን የቢንጎ ሬንጅ (B:1-15, I:16-30, N:31-45, G:46-60, O:61-75) የሚያመነጭ
function generateCardMatrix(cardId) {
    let seed = cardId * 997;
    function getRand(min, max, count) {
        let arr = [];
        while (arr.length < count) {
            seed = (seed * 9301 + 49297) % 233280;
            let num = Math.floor((seed / 233280) * (max - min + 1)) + min;
            if (!arr.includes(num)) arr.push(num);
        }
        return arr;
    }

    let b = getRand(1, 15, 5);
    let i = getRand(16, 30, 5);
    let n = getRand(31, 45, 4);
    n.splice(2, 0, "FREE"); // መካከለኛው ነፃ ቦታ
    let g = getRand(46, 60, 5);
    let o = getRand(61, 75, 5);

    // 5x5 ማትሪክስ መልክ ለማስያዝ (Column በ Column)
    let matrix = [];
    for (let row = 0; row < 5; row++) {
        matrix.push(b[row]);
        matrix.push(i[row]);
        matrix.push(n[row]);
        matrix.push(g[row]);
        matrix.push(o[row]);
    }
    return matrix;
}

function startRoomCycle() {
    gameState = 'WAITING';
    countdown = 30;
    currentDrawnNumbers = [];
    takenCards = {};

    if (drawTimer) clearInterval(drawTimer);
    if (gameTimer) clearInterval(gameTimer);

    gameTimer = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
            clearInterval(gameTimer);
            gameState = 'PLAYING';
            startNumberDrawing();
        }
    }, 1000);
}

function startNumberDrawing() {
    drawTimer = setInterval(() => {
        if (currentDrawnNumbers.length < 75 && gameState === 'PLAYING') {
            let num;
            do {
                num = Math.floor(Math.random() * 75) + 1;
            } while (currentDrawnNumbers.includes(num));
            
            currentDrawnNumbers.push(num);
        } else {
            clearInterval(drawTimer);
            setTimeout(startRoomCycle, 5000);
        }
    }, 3000);
}

startRoomCycle();

bot.start((ctx) => {
    const uid = ctx.from.id.toString();
    const startPayload = ctx.startPayload;

    if (!users[uid]) {
        users[uid] = { balance: 10 };

        if (startPayload && users[startPayload] && startPayload !== uid) {
            users[startPayload].balance += 10;
            ctx.telegram.sendMessage(startPayload, '🎉 አዲስ ተጫዋች ስለጋበዙ 10 ETB ቦነስ ወደ ሂሳብዎ ታክሏል!');
        }
    }

    const botUsername = ctx.botInfo.username;
    const inviteLink = `https://t.me/${botUsername}?start=${uid}`;

    ctx.reply(`👋 እንኳን ወደ የቤተሰብ 5x5 ቢንጎ በደህና መጡ!\n\n🎁 10 ETB ቦነስ ተሰጥቶዎታል።\n\n🔗 ጓደኛዎን ለመጋበዝ ይህንን ሊንክ ይጠቀሙ (ለእያንዳንዱ ሰው 10 ETB ያገኛሉ)፦\n${inviteLink}`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🎮 Open Yohans Bingo Mini App', web_app: { url: 'https://yohans-vn77.onrender.com' } }]
            ]
        }
    });
});

bot.launch();

app.get('/api/game-state', (req, res) => {
    res.json({ gameState, countdown, drawnNumbers: currentDrawnNumbers, takenCards });
});

app.get('/api/get-card/:cardId', (req, res) => {
    const cardId = parseInt(req.params.cardId);
    if (cardId < 1 || cardId > 200) return res.status(400).json({ error: "INVALID_CARD" });
    const matrix = generateCardMatrix(cardId);
    res.json({ cardId, matrix });
});

app.get('/api/user-data/:userId', (req, res) => {
    const uid = req.params.userId;
    if (!users[uid]) users[uid] = { balance: 10 };
    res.json(users[uid]);
});

app.post('/api/select-card', (req, res) => {
    const { userId, cardId, stake } = req.body;
    if (gameState !== 'WAITING') {
        return res.json({ success: false, message: "ጨዋታው ተጀምሯል! ቀጣዩን ዙር ይጠብቁ።" });
    }
    if (cardId < 1 || cardId > 200) {
        return res.json({ success: false, message: "ካርቴላ ቁጥር ከ 1 እስከ 200 መሆን አለበት!" });
    }
    if (takenCards[cardId]) {
        return res.json({ success: false, message: "ይህ ካርቴላ በሌላ ተጫዋች ተይዟል!" });
    }
    if (!users[userId]) users[userId] = { balance: 10 };
    if (users[userId].balance < stake) {
        return res.json({ success: false, message: "በቂ ሂሳብ የለዎትም!" });
    }

    users[userId].balance -= stake;
    takenCards[cardId] = { userId, stake };
    res.json({ success: true, newBalance: users[userId].balance });
});

app.post('/api/claim-bingo', (req, res) => {
    const { userId, cardId } = req.body;
    
    let totalPool = 0;
    Object.values(takenCards).forEach(c => totalPool += c.stake);

    const houseCut = totalPool * 0.20;
    const winAmount = totalPool - houseCut;

    houseProfit += houseCut;
    if (users[userId]) users[userId].balance += winAmount;

    startRoomCycle();

    res.json({ success: true, winAmount, newBalance: users[userId]?.balance || 0 });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Real Bingo Server running on port ${PORT}`));
