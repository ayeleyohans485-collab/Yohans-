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

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/yohans_bingo';
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ ከ MongoDB ጋር ተገናኝቷል');
}).catch(err => {
    console.error('❌ የ MongoDB ግንኙነት ተሳክቷል:', err);
});

// User Schema & Model with Wallet Support
const userSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    username: String,
    balance: { type: Number, default: 10.00 },
    bankAccount: { type: String, default: '' }
});
const User = mongoose.model('User', userSchema);

// Deposit & Balance API Routes
app.post('/api/deposit', async (req, res) => {
    try {
        const { telegramId, amount, txRef } = req.body;
        let user = await User.findOne({ telegramId });
        if (!user) {
            user = new User({ telegramId, balance: 10.00 });
        }
        user.balance += parseFloat(amount || 0);
        await user.save();
        res.json({ success: true, newBalance: user.balance });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/user/:telegramId', async (req, res) => {
    try {
        let user = await User.findOne({ telegramId: req.params.telegramId });
        if (!user) {
            user = await User.create({ telegramId: req.params.telegramId, balance: 10.00 });
        }
        res.json({ success: true, balance: user.balance });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Telegram Bot Setup via Webhook for Render
const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.WEB_APP_URL || 'https://yohans-vn77.onrender.com';

if (!token) {
    console.error('❌ BOT_TOKEN በ Environment Variables ውስጥ አልተገኘም!');
}

const bot = new Telegraf(token);

bot.start(async (ctx) => {
    try {
        let telegramId = ctx.from.id.toString();
        let username = ctx.from.username || 'User';
        let user = await User.findOne({ telegramId });
        if (!user) {
            await User.create({ telegramId, username, balance: 10.00 });
        }
    } catch (e) {
        console.error('Start user creation error:', e);
    }

    ctx.reply(`🎮 እንኳን ወደ Yohans Bingo በደህና መጡ!\n\nእውነተኛ ገንዘብ በመጫወት ሽልማት ያግኙ።`, Markup.keyboard([
        [Markup.button.webApp('🎮 Play Game', webAppUrl), Markup.button.text('Register 📝')],
        [Markup.button.text('Check Balance 💰'), Markup.button.text('Deposit 💳')],
        [Markup.button.text('Withdraw 🏦'), Markup.button.text('Instruction 📖')],
        [Markup.button.text('Contact Support 📞')]
    ]).resize());
});

bot.hears('Check Balance 💰', async (ctx) => {
    try {
        let telegramId = ctx.from.id.toString();
        let user = await User.findOne({ telegramId });
        let balance = user ? user.balance : 10.00;
        ctx.reply(`💰 የአሁን እውነተኛ ሂሳብዎ (Balance): ${balance.toFixed(2)} ETB`);
    } catch (e) {
        ctx.reply('❌ ሂሳብዎትን ማየት አልተቻለም።');
    }
});

bot.hears('Instruction 📖', (ctx) => {
    ctx.reply(`📖 የመጫወቻ መመሪያ:\n1. 🎮 Play Game የሚለውን በመጫወት ሚኒ አፕ ይክፈቱ።\n2. 💳 ሒሳብ በመሞላት ካርቴላ ይግዙ።\n3. 🔢 ቁጥሮች ሲመጡ ኑን በመጫወት ሽልማት ያሸንፉ!`);
});

bot.hears('Deposit 💳', (ctx) => {
    ctx.reply(`💳 ሂሳብ ለመሙላት በLattuu SACCO ወይም በባንክ አካውንት ከፍሎ የትራንዛክሽን ሪፈረንስ ይላኩ:\n\n🏦 አካውንት: 1000xxxxxx\n👤 ስም: Yohans Bingo`);
});

bot.hears('Withdraw 🏦', (ctx) => {
    ctx.reply(`🏦 ከሂሳብዎ ገንዘብ ለማውጣት የባንክ አካውንት ቁጥርዎን ይላኩ።`);
});

bot.hears('Register 📝', async (ctx) => {
    try {
        let telegramId = ctx.from.id.toString();
        let username = ctx.from.username || 'User';
        let user = await User.findOne({ telegramId });
        if (!user) {
            await User.create({ telegramId, username, balance: 10.00 });
            ctx.reply(`📝 ምዝገባዎ ተሳክቷል! 10.00 ETB የቦነስ ቀሪ ተሰጥቶዎታል።`);
        } else {
            ctx.reply(`📝 ቀደም ሲል ተመዝግበዋል! የአሁን ሂሳብዎ: ${user.balance.toFixed(2)} ETB ነው።`);
        }
    } catch (e) {
        ctx.reply('❌ ምዝገባ ላይ ችግር ተፈጥሯል።');
    }
});

bot.hears('Contact Support 📞', (ctx) => {
    ctx.reply(`📞 ለድጋፍ @Yohans_Support ያነጋግሩ።`);
});

// Express route for Telegram Webhook with safety timeout catch
app.use(bot.webhookCallback(`/teleg-webhook/${token}`));
bot.telegram.setWebhook(`${webAppUrl}/teleg-webhook/${token}`).catch(err => {
    console.log('⚠️ የዌብሁክ ማቀናበር ትንሽ ዘግይቷል:', err.message);
});

// Bingo Game Logic State
let gameTimer = 45;
let gameActive = false;
let calledNumbers = [];
let remainingNums = [];

function resetGame() {
    gameTimer = 45;
    gameActive = false;
    calledNumbers = [];
    remainingNums = Array.from({length: 75}, (_, i) => i + 1).sort(() => Math.random() - 0.5);
}

resetGame();

setInterval(() => {
    if (!gameActive) {
        if (gameTimer > 0) {
            gameTimer--;
        } else {
            gameActive = true;
            startCaller();
        }
        io.emit('timer_update', { timer: gameTimer, gameActive });
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
                io.emit('game_reset', { gameTimer, gameActive });
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

io.on('connection', (socket) => {
    socket.emit('init_state', {
        gameTimer,
        gameActive,
        calledNumbers
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`🚀 እውነተኛ ሰርቨር እና ዌብሁክ ቦቱ በፖርት ${PORT} በትክክል ተጀምረዋል`);
});
