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

// User Schema & Model
const userSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    username: String,
    balance: { type: Number, default: 10.00 }
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

// Telegram Bot Setup
const token = process.env.BOT_TOKEN;
if (!token) {
    console.error('❌ BOT_TOKEN በ Environment Variables ውስጥ አልተገኘም!');
}

const bot = new Telegraf(token);
const webAppUrl = process.env.WEB_APP_URL || 'https://yohans-vn77.onrender.com';

bot.start((ctx) => {
    ctx.reply(`🎮 እንኳን ወደ Yohans Bingo በደህና መጡ!`, Markup.keyboard([
        [Markup.button.webApp('🎮 Play', webAppUrl), Markup.button.text('Register 📝')],
        [Markup.button.text('Check Balance 💰'), Markup.button.text('Deposit 💳')],
        [Markup.button.text('Contact Support 📞'), Markup.button.text('Instruction 📖')],
        [Markup.button.text('Transfer 💸'), Markup.button.text('Withdraw 🏦')]
    ]).resize());
});

bot.hears('Check Balance 💰', async (ctx) => {
    try {
        let telegramId = ctx.from.id.toString();
        let user = await User.findOne({ telegramId });
        let balance = user ? user.balance : 10.00;
        ctx.reply(`💰 የአሁን ሂሳብዎ (Balance): ${balance.toFixed(2)} ETB`);
    } catch (e) {
        ctx.reply('❌ ሂሳብዎትን ማየት አልተቻለም።');
    }
});

bot.hears('Instruction 📖', (ctx) => {
    ctx.reply(`📖 የመጫወቻ መመሪያ:\n1. 🎮 Play የሚለውን በመጫወት ሚኒ አፕ ይክፈቱ።\n2. 💳 ሒሳብ በመሞላት ካርቴላ ይግዙ።\n3. 🔢 ቁጥሮች ሲመጡ እያስተካከሉ ኑን ይበሉ።`);
});

bot.hears('Deposit 💳', (ctx) => {
    ctx.reply(`💳 ሂሳብ ለመሙላት በLattuu SACCO ወይም በባንክ አካውንት ያስተላልፉ።`);
});

bot.hears('Withdraw 🏦', (ctx) => {
    ctx.reply(`🏦 ከሂሳብዎ ገንዘብ ለማውጣት የባንክ አካውንት ቁጥርዎን ይላኩ።`);
});

bot.hears('Register 📝', (ctx) => {
    ctx.reply(`📝 ምዝገባዎ ተሳክቷል!`);
});

bot.hears('Contact Support 📞', (ctx) => {
    ctx.reply(`📞 ለድጋፍ @Yohans_Support ያነጋግሩ።`);
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
    console.log(`🚀 ሰርቨር በፖርት ${PORT} እየሰራ ነው`);
    
    // ቦቱን ከሰርቨር መነሳት ጋር በአንድ ላይ ማስጀመር
    bot.launch().then(() => {
        console.log('🤖 የቴሌግራም ቦቱ በትክክል ተጀምሯል');
    }).catch(err => {
        console.error('❌ ቦቱን ማስጀመር አልተቻለም:', err);
    });
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
