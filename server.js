const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection (Non-blocking)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/yohans_bingo';
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
}).then(() => {
    console.log('✅ ከ MongoDB ጋር ተገናኝቷል');
}).catch(err => {
    console.error('❌ የ MongoDB ግንኙነት አልተሳካም (ነገር ግን ቦቱ ይሰራል።)');
});

// User Schema
const userSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    username: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    balance: { type: Number, default: 10.00 },
    playWallet: { type: Number, default: 0.00 },
    referredBy: { type: String, default: null },
    referralCount: { type: Number, default: 0 },
    pendingAction: { type: String, default: null }
});
const User = mongoose.model('User', userSchema);

// Game State variables
let gameTimer = 45;
let gameActive = false;
let calledNumbers = [];
let remainingNums = [];
let activePlayers = [];

function resetGame() {
    gameTimer = 45;
    gameActive = false;
    calledNumbers = [];
    activePlayers = [];
    remainingNums = Array.from({length: 75}, (_, i) => i + 1).sort(() => Math.random() - 0.5);
}

resetGame();

// API Routes - Get User Data
app.get('/api/user/:telegramId', async (req, res) => {
    try {
        let user = await User.findOne({ telegramId: req.params.telegramId });
        if (user) {
            res.json({ success: true, balance: user.balance, playWallet: user.playWallet });
        } else {
            res.json({ success: true, balance: 10.00, playWallet: 0.00 });
        }
    } catch (e) {
        res.json({ success: true, balance: 10.00, playWallet: 0.00 });
    }
});

// API Routes - Select Cards & Deduct Stake
app.post('/api/select-cards', async (req, res) => {
    try {
        let { telegramId, selectedCards } = req.body;
        
        if (selectedCards && selectedCards.length > 0) {
            if (!activePlayers.includes(telegramId)) {
                activePlayers.push(telegramId);
            }
        } else {
            activePlayers = activePlayers.filter(id => id !== telegramId);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Timer Loop
setInterval(() => {
    if (!gameActive) {
        if (activePlayers.length > 0) {
            if (gameTimer > 0) {
                gameTimer--;
            } else {
                gameActive = true;
                startCaller();
            }
        } else {
            gameTimer = 45; 
        }

        io.emit('timer_update', { 
            timer: gameTimer, 
            gameActive, 
            waitingForPlayers: activePlayers.length === 0 
        });
    }
}, 1000);

let callerInterval = null;
function startCaller() {
    if (callerInterval) clearInterval(callerInterval);
    
    callerInterval = setInterval(() => {
        if (remainingNums.length === 0) {
            clearInterval(callerInterval);
            setTimeout(() => {
                resetGame();
                io.emit('game_reset', { gameTimer, gameActive, waitingForPlayers: true });
            }, 5000);
            return;
        }
        let currentNumber = remainingNums.pop();
        calledNumbers.push(currentNumber);

        io.emit('number_called', {
            currentNumber,
            calledNumbers
        });
    }, 3000);
}

// Telegram Bot Setup
const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.WEB_APP_URL || 'https://yohans-vn77.onrender.com';
const ADMIN_CHAT_ID = '7833077977';

const bot = new Telegraf(token);

bot.start(async (ctx) => {
    ctx.reply(`👋 Welcome to Yohans Bingo! Share your phone number to get your 10.00 ETB bonus.`, Markup.keyboard([
        [Markup.button.contactRequest('📱 Share Contact')]
    ]).resize().oneTime());
});

// Share Contact Handler
bot.on('contact', async (ctx) => {
    try {
        let phoneNumber = ctx.message.contact ? ctx.message.contact.phone_number : 'Unknown';

        await ctx.telegram.sendMessage(ctx.chat.id, `✅ ምዝገባዎ ተጠናቋል! 10.00 ብር ቦነስ ተሰጥቶዎታል።`, {
            reply_markup: { remove_keyboard: true }
        });

        await ctx.reply(`👇 ከታች ካሉት አማራጮች አንዱን ይምረጡ፦`, Markup.keyboard([
            [Markup.button.webApp('🎮 Play Game', webAppUrl)],
            [Markup.button.text('Check Balance 💰'), Markup.button.text('Referral 🎁')],
            [Markup.button.text('Deposit Telebirr 💳'), Markup.button.text('Withdraw Telebirr 🏦')]
        ]).resize());

        User.updateOne(
            { telegramId: ctx.from.id.toString() },
            { 
                $set: { 
                    username: ctx.from.username || 'User', 
                    phoneNumber 
                },
                $setOnInsert: { balance: 10.00, playWallet: 0.00 }
            },
            { upsert: true }
        ).catch(err => console.log('DB save background error:', err.message));

    } catch (e) {
        console.error('Contact error:', e);
        ctx.reply(`⚠️ ስህተት አጋጥሟል፣ እባክዎ እንደገና ይሞክሩ።`);
    }
});

// Menu Handlers
bot.hears('Check Balance 💰', async (ctx) => {
    try {
        let user = await User.findOne({ telegramId: ctx.from.id.toString() });
        let bal = user ? user.balance : 10.00;
        let play = user ? user.playWallet : 0.00;
        ctx.reply(`💰 የሂሳብዎ ሁኔታ:\n- Main Wallet: ${bal.toFixed(2)} ETB\n- Play Wallet: ${play.toFixed(2)} ETB`);
    } catch (e) {
        ctx.reply(`💰 የሂሳብዎ ሁኔታ:\n- Main Wallet: 10.00 ETB\n- Play Wallet: 0.00 ETB`);
    }
});

bot.hears('Deposit Telebirr 💳', async (ctx) => {
    ctx.reply(`📱 በቴሌብር ሂሳብ ለመሙላት (Deposit):\n\nእባክዎ ከታች ባለው የቴሌብር ቁጥር ገንዘብ ያስተላልፉ:\n🔹 Telebirr: 09xxxxxxxx\n👤 ስም: Yohans Ayele\n\nከፍለው ሲጨርሱ የትራንዛክሽን ሪፈረንስ ቁጥር (Reference No) ወይም የክፍያ ስክሪንሾት ይላኩ።`);
});

bot.hears('Withdraw Telebirr 🏦', async (ctx) => {
    ctx.reply(`🏦 በቴሌብር ገንዘብ ለማውጣት (Withdraw):\n\nእባክዎ የሚወጣውን መጠን እና የቴሌብር ቁጥርዎን በዚህ መልኩ ይጻፉ (ለምሳሌ: 50 09xxxxxxxx):`);
});

bot.hears('Referral 🎁', async (ctx) => {
    let botInfo = await bot.telegram.getMe();
    let refLink = `https://t.me/${botInfo.username}?start=${ctx.from.id}`;
    ctx.reply(`🎁 ጓደኛ በመጋበዝ ቋሚ ቦኑስ ያግኙ!\n\nየጋበዣ ሊንክዎ:\n${refLink}`, {
        disable_web_page_preview: true
    });
});

bot.on('text', async (ctx) => {
    let text = ctx.message.text;
    if (text && text.includes('09')) {
        await bot.telegram.sendMessage(ADMIN_CHAT_ID, `🔔 አዲስ የቴሌብር Withdraw/Deposit ጥያቄ:\n👤 Username: @${ctx.from.username || 'None'}\n🆔 ID: ${ctx.from.id}\n📝 ዝርዝር: ${text}`);
        return ctx.reply(`✅ ጥያቄዎ ተቀባይነት አግኝቷል! በአጭር ጊዜ ውስጥ ይስተናገዳል።`);
    }
});

bot.launch();

io.on('connection', (socket) => {
    socket.emit('init_state', {
        gameTimer,
        gameActive,
        calledNumbers,
        waitingForPlayers: activePlayers.length === 0
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 ሰርቨሩ በፖርት ${PORT} ተጀምሯል`);
});
