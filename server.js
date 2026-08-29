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

// User Schema with Referral Support
const userSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    username: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    balance: { type: Number, default: 0.00 },
    bankAccount: { type: String, default: '' },
    referredBy: { type: String, default: null },
    referralCount: { type: Number, default: 0 },
    pendingAction: { type: String, default: null }
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

// Telegram Bot Setup via Long Polling (ፈጣን እና የማይቀዘቅዝ)
const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.WEB_APP_URL || 'https://yohans-vn77.onrender.com';
const ADMIN_CHAT_ID = '7833077977';

if (!token) {
    console.error('❌ BOT_TOKEN በ Environment Variables ውስጥ አልተገኘም!');
}

const bot = new Telegraf(token);

// /start ሲሉ
bot.start(async (ctx) => {
    let telegramId = ctx.from.id.toString();
    let username = ctx.from.username || 'User';
    let startPayload = ctx.payload; 

    try {
        let user = await User.findOne({ telegramId });
        if (!user) {
            let referrerId = (startPayload && startPayload !== telegramId) ? startPayload : null;

            await User.create({
                telegramId,
                username,
                phoneNumber: '',
                balance: 0.00,
                referredBy: referrerId,
                referralCount: 0
            });
        }
    } catch (e) {
        console.error('Start error:', e);
    }

    ctx.reply(`👋 Welcome to Yohans Bingo! To register and get your 10.00 ETB welcome bonus, please share your phone number using the button below.`, Markup.keyboard([
        [Markup.button.contactRequest('📱 Share Contact')]
    ]).resize().oneTime());
});

// ስልክ ቁጥር ሲያጋሩ
bot.on('contact', async (ctx) => {
    try {
        let telegramId = ctx.from.id.toString();
        let username = ctx.from.username || 'User';
        let phoneNumber = ctx.message && ctx.message.contact ? ctx.message.contact.phone_number : 'Unknown';

        let user = await User.findOne({ telegramId });
        let isNewRegistration = false;

        if (!user) {
            isNewRegistration = true;
            user = await User.create({
                telegramId,
                username,
                phoneNumber,
                balance: 10.00
            });
        } else {
            if (!user.phoneNumber || user.phoneNumber === '') {
                isNewRegistration = true;
            }
            user.phoneNumber = phoneNumber;
            if (user.balance < 10) user.balance = 10.00;
            user.pendingAction = null;
            await user.save();
        }

        // ሪፈራል ቦነስ መስጠት
        if (isNewRegistration && user.referredBy) {
            let referrer = await User.findOne({ telegramId: user.referredBy });
            if (referrer) {
                referrer.balance += 5.00;
                referrer.referralCount += 1;
                await referrer.save();

                bot.telegram.sendMessage(referrer.telegramId, `🎉 እንኳን ደስ አለዎት! ጓደኛዎ (${username}) ቦቱን በመጠቀም ተመዝግቧል። የሪፈራል ቦነስ 5.00 ETB ወደ ሂሳብዎ ተጨምሯል! 💰\n\nየአሁን ሂሳብዎ: ${referrer.balance.toFixed(2)} ETB`);
            }
        }

        await ctx.reply(
            `✅ Registration complete! You've received your 10.00 ETB welcome bonus.\n\n🎮 Choose an option below:`,
            Markup.keyboard([
                [Markup.button.webApp('🎮 Play Game', webAppUrl)],
                [Markup.button.text('Check Balance 💰'), Markup.button.text('Referral 🎁')],
                [Markup.button.text('Deposit 💳'), Markup.button.text('Withdraw 🏦')],
                [Markup.button.text('Instruction 📖')]
            ]).resize()
        );

    } catch (e) {
        console.error('Contact registration error:', e);
        await ctx.reply(
            `✅ Registration successful! Welcome to Yohans Bingo.`,
            Markup.keyboard([
                [Markup.button.webApp('🎮 Play Game', webAppUrl)],
                [Markup.button.text('Check Balance 💰'), Markup.button.text('Referral 🎁')],
                [Markup.button.text('Deposit 💳'), Markup.button.text('Withdraw 🏦')],
                [Markup.button.text('Instruction 📖')]
            ]).resize()
        );
    }
});

// 🎁 Referral ቁልፍ ሲጫኑ
bot.hears('Referral 🎁', async (ctx) => {
    let telegramId = ctx.from.id.toString();
    let botUsername = ctx.botInfo ? ctx.botInfo.username : 'yohans_bingo_bot';
    let referralLink = `https://t.me/${botUsername}?start=${telegramId}`;

    try {
        let user = await User.findOne({ telegramId });
        let count = user ? user.referralCount : 0;

        ctx.reply(`🎁 **የሪፈራል መርሃ ግብር (Invite & Earn)**\n\n👥 የጋበዟቸው ሰዎች ብዛት: **${count} ሰው**\n💰 ያገኙት የሪፈራል ቦነስ: **${(count * 5).toFixed(2)} ETB**\n\n🔗 የእርስዎ ልዩ የጋበዣ ሊንክ:\n${referralLink}\n\nይህንን ሊንክ ለጓደኛዎችዎ በመላክ ቦቱን እንዲቀላቀሉ ሲያደርጉ 5.00 ETB ይሸለማሉ!`);
    } catch (e) {
        ctx.reply(`🎁 የእርስዎ የጋበዣ ሊንክ:\n${referralLink}`);
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
    ctx.reply(`📖 የመጫወቻ መመሪያ:\n1. 🎮 Play Game የሚለውን በመጫወት ሚኒ አፕ ይክፈቱ።\n2. 💳 ሒሳብ በመሞላት ካርቴላ ይግዙ።\n3. 🎁 Referral በመጫወት ጓደኛዎችን ይጋብዙ!`);
});

// 💳 Deposit
bot.hears('Deposit 💳', async (ctx) => {
    try {
        let telegramId = ctx.from.id.toString();
        await User.updateOne({ telegramId }, { pendingAction: 'deposit' });
    } catch (e) {
        console.error(e);
    }
    ctx.reply(`💳 ሂሳብ ለመሙላት ከታች ባለው የባንክ አካውንት ከፍሎ የትራንዛክሽን ሪፈረንስ ቁጥር (Reference No) ይላኩ:\n\n🏦 አካውንት: 1000xxxxxx\n👤 ስም: Yohans Bingo`);
});

// 🏦 Withdraw
bot.hears('Withdraw 🏦', async (ctx) => {
    try {
        let telegramId = ctx.from.id.toString();
        await User.updateOne({ telegramId }, { pendingAction: 'withdraw' });
    } catch (e) {
        console.error(e);
    }
    ctx.reply(`🏦 ከሂሳብዎ ገንዘብ ለማውጣት የሚፈልጉትን መጠን እና የባንክ ወይም የቴሌብር አካውንት ቁጥርዎን ይጻፉ (ለምሳሌ: 300 ብር እና 09xxxxxxxx):`);
});

// Text handler for Withdraw/Deposit requests
bot.on('text', async (ctx) => {
    let text = ctx.message.text;
    if (text.startsWith('/')) return;

    let telegramId = ctx.from.id.toString();
    let username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

    try {
        let user = await User.findOne({ telegramId });
        if (!user || !user.pendingAction) return;

        if (user.pendingAction === 'withdraw') {
            ctx.reply(`✅ የገንዘብ ማውጣት ጥያቄዎ በትክክል ተቀባይነት አግኝቷል! በአጭር ጊዜ ውስጥ ወደ አካውንትዎ ይላካል።`);
            bot.telegram.sendMessage(ADMIN_CHAT_ID, `🔔 **አዲስ የገንዘብ ማውጣት ጥያቄ!**\n\n👤 ተጠቃሚ: ${username}\n🆔 ID: ${telegramId}\n📱 ስልክ: ${user.phoneNumber || 'አልታወቀም'}\n💬 ዝርዝር ጥያቄ: ${text}`);

            user.pendingAction = null;
            await user.save();

        } else if (user.pendingAction === 'deposit') {
            ctx.reply(`✅ የዲፖዚት ማረጋገጫዎ ደርሶናል! በአጭር ጊዜ ውስጥ ተረጋግጦ ሂሳብዎ ይስተካከላል።`);
            bot.telegram.sendMessage(ADMIN_CHAT_ID, `💳 **አዲስ የዲፖዚት ሪፈረንስ መረጃ!**\n\n👤 ተጠቃሚ: ${username}\n🆔 ID: ${telegramId}\n📱 ስልክ: ${user.phoneNumber || 'አልታወቀም'}\n💬 ሪፈረንስ/መልእክት: ${text}`);

            user.pendingAction = null;
            await user.save();
        }
    } catch (e) {
        console.error('Text handler error:', e);
    }
});

// ቦቱን በ Long Polling ማስጀመር (Webhookን ማጥፋት እና ቀጥታ ማገናኘት)
bot.launch().then(() => {
    console.log('🤖 ቴሌግራም ቦቱ በ (Long Polling) ፈጣን በሆነ ሁኔታ ተጀምሯል!');
}).catch(err => {
    console.error('❌ ቦቱን ማስጀመር አልተቻለም:', err);
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

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
