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

// User Schema
const userSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    username: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    balance: { type: Number, default: 0.00 },
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

// API Routes
app.get('/api/user/:telegramId', async (req, res) => {
    try {
        let user = await User.findOne({ telegramId: req.params.telegramId });
        if (!user) {
            return res.json({ success: true, balance: 10.00, playWallet: 0.00 });
        }
        res.json({ success: true, balance: user.balance, playWallet: user.playWallet });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

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

// Timer Loop: ቢያንስ 1 ተጫዋች ካርቴላ ከያዘ ብቻ ሰዓቱ ይቀንሳል
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
            gameTimer = 45; // ተጫዋች ከሌለ ሰዓቱ 45 ሆኖ ይጠብቃል
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
    let telegramId = ctx.from.id.toString();
    let username = ctx.from.username || 'User';
    let startPayload = ctx.payload; 

    try {
        let user = await User.findOne({ telegramId });
        if (!user) {
            let referrerId = (startPayload && startPayload !== telegramId) ? startPayload : null;
            await User.create({
                telegramId, username, phoneNumber: '', balance: 0.00, playWallet: 0.00, referredBy: referrerId
            });
        }
    } catch (e) {
        console.error('Start error:', e);
    }

    ctx.reply(`👋 Welcome to Yohans Bingo! Share your phone number to get your 10.00 ETB bonus.`, Markup.keyboard([
        [Markup.button.contactRequest('📱 Share Contact')]
    ]).resize().oneTime());
});

// Share Contact Handler with error details
bot.on('contact', async (ctx) => {
    try {
        let telegramId = ctx.from.id.toString();
        let username = ctx.from.username || 'User';
        let phoneNumber = ctx.message.contact ? ctx.message.contact.phone_number : 'Unknown';

        let user = await User.findOne({ telegramId });
        if (!user) {
            await User.create({ 
                telegramId, 
                username, 
                phoneNumber, 
                balance: 10.00, 
                playWallet: 0.00 
            });
        } else {
            user.phoneNumber = phoneNumber;
            if (user.balance < 10) user.balance = 10.00;
            await user.save();
        }

        // ኪቦርዱን በማጥፋት መልእክት መላክ
        await ctx.telegram.sendMessage(ctx.chat.id, `✅ ምዝገባዎ ተጠናቋል! 10.00 ብር ቦነስ ተሰጥቶዎታል።`, {
            reply_markup: { remove_keyboard: true }
        });

        // ዋናውን ሜኑ መላክ
        await ctx.reply(`👇 ከታች ካሉት አማራጮች አንዱን ይምረጡ፦`, Markup.keyboard([
            [Markup.button.webApp('🎮 Play Game', webAppUrl)],
            [Markup.button.text('Check Balance 💰'), Markup.button.text('Referral 🎁')],
            [Markup.button.text('Deposit Telebirr 💳'), Markup.button.text('Withdraw Telebirr 🏦')]
        ]).resize());

    } catch (e) {
        console.error('Contact error detail:', e);
        ctx.reply(`⚠️ ስህተት አጋጥሟል: ${e.message}`);
    }
});

// Menu Handlers
bot.hears('Check Balance 💰', async (ctx) => {
    let user = await User.findOne({ telegramId: ctx.from.id.toString() });
    let bal = user ? user.balance : 0.00;
    let playBal = user ? user.playWallet : 0.00;
    ctx.reply(`💰 የሂሳብዎ ሁኔታ:\n- Main Wallet: ${bal.toFixed(2)} ETB\n- Play Wallet: ${playBal.toFixed(2)} ETB`);
});

bot.hears('Deposit Telebirr 💳', async (ctx) => {
    ctx.reply(`📱 በቴሌብር ሂሳብ ለመሙላት (Deposit):\n\nእባክዎ ከታች ባለው የቴሌብር ቁጥር ገንዘብ ያስተላልፉ:\n🔹 Telebirr: 09xxxxxxxx\n👤 ስም: Yohans Ayele\n\nከፍለው ሲጨርሱ የትራንዛክሽን ሪፈረንስ ቁጥር (Reference No) ወይም የክፍያ ስክሪንሾት ይላኩ።`);
});

bot.hears('Withdraw Telebirr 🏦', async (ctx) => {
    let user = await User.findOne({ telegramId: ctx.from.id.toString() });
    if (!user || user.balance <= 0) {
        return ctx.reply(`⚠️ ማውጣት የሚችሉት በቂ ሂሳብ የለዎትም!`);
    }
    ctx.reply(`🏦 በቴሌብር ገንዘብ ለማውጣት (Withdraw):\n\nእባክዎ የሚወጣውን መጠን እና የቴሌብር ቁጥርዎን በዚህ መልኩ ይጻፉ (ለምሳሌ: 50 09xxxxxxxx):`);
    user.pendingAction = 'waiting_for_telebirr_withdraw';
    await user.save();
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
    let telegramId = ctx.from.id.toString();
    let user = await User.findOne({ telegramId });

    if (user && user.pendingAction === 'waiting_for_telebirr_withdraw') {
        user.pendingAction = null;
        await user.save();
        
        await bot.telegram.sendMessage(ADMIN_CHAT_ID, `🔔 አዲስ የቴሌብር Withdraw ጥያቄ:\n👤 Username: @${ctx.from.username || 'None'}\n🆔 ID: ${telegramId}\n📝 ዝርዝር: ${text}`);
        return ctx.reply(`✅ የቴሌብር ገንዘብ ማውጣት ጥያቄዎ ተቀባይነት አግኝቷል! በአጭር ጊዜ ውስጥ ወደ ቴሌብር ቁጥርዎ ይላካል።`);
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
