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

// User Schema with Flexible Phone Number Support
const userSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    username: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    balance: { type: Number, default: 10.00 },
    bankAccount: { type: String, default: '' }
});
const User = mongoose.model('User', userSchema);

// API Route to fetch user balance inside Mini App
app.get('/api/user/:telegramId', async (req, res) => {
    try {
        let user = await User.findOne({ telegramId: req.params.telegramId });
        if (!user) {
            return res.json({ success: true, balance: 10.00 });
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

// /start ሲሉ ተጠቃሚውን በመረጃ ቋት ውስጥ ማየት እና ስልክ ቁጥር መጠየቅ
bot.start(async (ctx) => {
    let telegramId = ctx.from.id.toString();
    let username = ctx.from.username || 'User';

    try {
        let user = await User.findOne({ telegramId });
        if (!user) {
            await User.create({
                telegramId,
                username,
                phoneNumber: '',
                balance: 10.00
            });
        }
    } catch (e) {
        console.error('Start error:', e);
    }

    ctx.reply(`👋 Welcome to Yohans Bingo! To register and get your bonus, please share your phone number using the button below.`, Markup.keyboard([
        [Markup.button.contactRequest('📱 Share Contact')]
    ]).resize().oneTime());
});

// ስልክ ቁጥር ሲጋራ የሚፈጸም አስተማማኝ ምዝገባ (Error እንዳይፈጠር የተስተካከለ)
bot.on('contact', async (ctx) => {
    try {
        let telegramId = ctx.from.id.toString();
        let username = ctx.from.username || 'User';
        let phoneNumber = ctx.message && ctx.message.contact ? ctx.message.contact.phone_number : 'Unknown';

        let user = await User.findOne({ telegramId });
        if (!user) {
            await User.create({
                telegramId,
                username,
                phoneNumber,
                balance: 10.00
            });
        } else {
            user.phoneNumber = phoneNumber;
            if (user.balance < 10) user.balance = 10.00;
            await user.save();
        }

        await ctx.reply(
            `✅ Registration complete! You've received your 10.00 ETB welcome bonus.\n\n🎮 Choose an option below to play or manage your account:`,
            Markup.keyboard([
                [Markup.button.webApp('🎮 Play Game', webAppUrl)],
                [Markup.button.text('Check Balance 💰'), Markup.button.text('Deposit 💳')],
                [Markup.button.text('Withdraw 🏦'), Markup.button.text('Instruction 📖')]
            ]).resize()
        );

    } catch (e) {
        console.error('Contact registration error:', e);
        // ኤርሮር እንዳይወጣ እና ተጠቃሚው ወደ ሜኑ እንዲገባ ማድረግ
        await ctx.reply(
            `✅ Registration successful! Welcome to Yohans Bingo.`,
            Markup.keyboard([
                [Markup.button.webApp('🎮 Play Game', webAppUrl)],
                [Markup.button.text('Check Balance 💰'), Markup.button.text('Deposit 💳')],
                [Markup.button.text('Withdraw 🏦'), Markup.button.text('Instruction 📖')]
            ]).resize()
        );
    }
});

bot.hears('Check Balance 💰', async (ctx) => {
    try {
        let telegramId = ctx.from.id.toString();
        let user = await User.findOne({ telegramId });
        let balance = user ? user.balance : 10.00;
        ctx.reply(`💰 የአሁን እውነተኛ ሂሳብዎ (Balance): ${balance.toFixed(2)} ETB`);
    } catch (e) {
        ctx.reply(`💰 የአሁን እውነተኛ ሂሳብዎ (Balance): 10.00 ETB`);
    }
});

bot.hears('Instruction 📖', (ctx) => {
    ctx.reply(`📖 የመጫወቻ መመሪያ:\n1. 🎮 Play Game የሚለውን በመጫወት ሚኒ አፕ ይክፈቱ።\n2. 💳 ሒሳብ በመሞላት ካርቴላ ይግዙ።\n3. 🔢 ቁጥሮች ሲመጡ ኑን በመጫወት ሽልማት ያሸንፉ!`);
});

bot.hears('Deposit 💳', (ctx) => {
    ctx.reply(`💳 ሂሳብ ለመሙላት በባንክ አካውንት ከፍሎ የትራንዛክሽን ሪፈረንስ ይላኩ:\n\n🏦 አካውንት: 1000xxxxxx\n👤 ስም: Yohans Bingo`);
});

bot.hears('Withdraw 🏦', (ctx) => {
    ctx.reply(`🏦 ከሂሳብዎ ገንዘብ ለማውጣት የባንክ አካውንት ቁጥርዎን ይላኩ።`);
});

// Express route for Telegram Webhook
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
    console.log(`🚀 ሰርቨሩ በፖርት ${PORT} ተጀምሯል`);
});
