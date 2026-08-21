require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');

// 1. ዳታቤዝ ማገናኘት
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected successfully!'))
.catch((err) => console.error('MongoDB Connection Error:', err));

// 2. የዩዘር ሞዴል
const userSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    firstName: { type: String },
    mainWallet: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ADMIN_ID = process.env.ADMIN_ID;
const MINI_APP_URL = process.env.MINI_APP_URL;
const BANK_INFO = "0938331486 (Yohans)";

app.use(express.json());
app.use(express.static(path.join(__dirname, 'miniapp')));

// 3. የሚኒ አፕ (Mini App) API
app.post('/api/play', async (req, res) => {
    try {
        const { telegramId, betAmount } = req.body;
        const user = await User.findOne({ telegramId });
        if (user && user.mainWallet >= betAmount) {
            user.mainWallet -= betAmount;
            await user.save();
            res.json({ success: true, newBalance: user.mainWallet });
        } else {
            res.json({ success: false, message: 'በቂ ብር የለዎትም!' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'ሰርቨር ስህተት አጋጥሟል' });
    }
});

app.post('/api/win', async (req, res) => {
    try {
        const { telegramId, prize } = req.body;
        const user = await User.findOneAndUpdate(
            { telegramId }, 
            { $inc: { mainWallet: prize } },
            { new: true }
        );
        res.json({ success: true, newBalance: user ? user.mainWallet : 0 });
    } catch (err) {
        res.status(500).json({ success: false, message: 'ሰርቨር ስህተት አጋጥሟል' });
    }
});

// 4. የቴሌግራም ቦት ማዋቀሪያ
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const firstName = msg.from.first_name || 'ተጫዋች';
    const referrerId = match[1];

    let user = await User.findOne({ telegramId });
    if (!user) {
        user = await User.create({ telegramId, firstName, mainWallet: 10 });
        if (referrerId && referrerId !== telegramId) {
            await User.findOneAndUpdate({ telegramId: referrerId }, { $inc: { mainWallet: 10 } });
        }
    }

    bot.sendMessage(chatId, `👋 **Welcome to Yohans Bingo, ${firstName}!**\n\n🎁 አዲስ በመመዝገብዎ **10 ብር ዌልካም ቦነስ** አግኝተዋል!`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🎮 Play Yohans Bingo', web_app: { url: MINI_APP_URL } }, { text: '💰 Balance', callback_data: 'balance' }],
                [{ text: '💳 Deposit', callback_data: 'deposit' }, { text: '🔗 Invite', callback_data: 'invite' }]
            ]
        }
    });
});

bot.on('callback_query', async (q) => {
    const chatId = q.message.chat.id;
    const telegramId = q.from.id.toString();
    const data = q.data;

    let user = await User.findOne({ telegramId });

    if (data === 'balance') {
        const balance = user ? user.mainWallet : 0;
        bot.sendMessage(chatId, `💰 የእርስዎ ቀሪ ሂሳብ: ${balance} ብር ነው`);
    } else if (data === 'deposit') {
        bot.sendMessage(chatId, `💳 **Yohans Bingo Deposit**\n\nእባክዎ ብሩን ወደዚህ የቴሌብር ቁጥር ይላኩ:\n👉 **${BANK_INFO}**`);
    } else if (data === 'invite') {
        bot.sendMessage(chatId, `🔗 **Invite Friends & Earn**\n\nጓደኛዎችዎን በመጋበዝ 10 ብር ቦነስ ያግኙ!`);
    }

    bot.answerCallbackQuery(q.id);
});

bot.onText(/\/add (\d+) (\d+)/, async (msg, match) => {
    if (msg.from.id.toString() === ADMIN_ID) {
        const targetId = match[1];
        const amount = Number(match[2]);
        let user = await User.findOneAndUpdate({ telegramId: targetId }, { $inc: { mainWallet: amount } }, { new: true });
        bot.sendMessage(msg.chat.id, `✅ ተሳክቷል! ለተጠቃሚ ${targetId} መጠን ${amount} ብር ተጭኗል። ቀሪ ሂሳብ: ${user ? user.mainWallet : amount} ብር`);
    }
});

bot.onText(/\/(deduct|withdraw) (\d+) (\d+)/, async (msg, match) => {
    if (msg.from.id.toString() === ADMIN_ID) {
        const targetId = match[2];
        const amount = Number(match[3]);
        let user = await User.findOne({ telegramId: targetId });
        if (user) {
            user.mainWallet = Math.max(0, user.mainWallet - amount);
            await user.save();
            bot.sendMessage(msg.chat.id, `✅ ተሳክቷል! ከተጠቃሚ ${targetId} ላይ ${amount} ብር ቀንሷል። ቀሪ ሂሳብ: ${user.mainWallet} ብር`);
        }
    }
});

// 5. የሪል-ታይም ቁጥር ጥሪ ሞተር (Socket.io)
io.on('connection', (socket) => {
    socket.on('start_game_room', () => {
        let calledNumbers = [];
        const interval = setInterval(() => {
            if (calledNumbers.length >= 75) { clearInterval(interval); return; }
            let randomNum;
            do { randomNum = Math.floor(Math.random() * 75) + 1; } while (calledNumbers.includes(randomNum));
            calledNumbers.push(randomNum);
            io.emit('number_called', { number: randomNum, allCalled: calledNumbers });
        }, 5000);
    });
});

server.listen(PORT, () => console.log(`Yohans Bingo Server running on port ${PORT}`));
