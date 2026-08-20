const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = '@Yohans12121';
const WEB_APP_URL = 'https://yohans-vn77.onrender.com';

if (!BOT_TOKEN) {
    console.error("Error: BOT_TOKEN is not set in environment variables!");
    process.exit(1);
}

app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

const webhookUrl = `${WEB_APP_URL}/bot${BOT_TOKEN}`;
bot.setWebHook(webhookUrl).then(() => {
    console.log(`Webhook set to: ${webhookUrl}`);
}).catch((err) => console.error('Webhook set error:', err));

app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Temp Database
const usersData = {};

async function isUserInChannel(userId) {
    try {
        const member = await bot.getChatMember(CHANNEL_USERNAME, userId);
        return ['creator', 'administrator', 'member'].includes(member.status);
    } catch (e) {
        return false;
    }
}

bot.onText(/\/start(?:\s+ref_(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const referrerId = match ? match[1] : null;

    const isJoined = await isUserInChannel(userId);
    if (!isJoined) {
        return bot.sendMessage(
            chatId,
            `⚠️ **ቦቱን ለመጠቀም አስቀድመው ቻናላችንን መቀላቀል አለብዎት!**`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📢 Join Channel", url: `https://t.me/${CHANNEL_USERNAME.replace('@', '')}` }]
                    ]
                },
                parse_mode: 'Markdown'
            }
        );
    }

    if (!usersData[userId]) {
        usersData[userId] = { balance: 10.00, referrals: 0 };
        if (referrerId && usersData[referrerId]) {
            usersData[referrerId].balance += 10.00;
            usersData[referrerId].referrals += 1;
            bot.sendMessage(referrerId, `🎉 **አዲስ ሰው ገብቷል!** +10.00 ETB አግኝተዋል።`);
        }
    }

    const mainKeyboard = {
        reply_markup: {
            keyboard: [
                [{ text: "🎮 Open Yohans Bingo Mini App", web_app: { url: WEB_APP_URL } }],
                [{ text: "💳 My Balance" }, { text: "📥 Deposit" }],
                [{ text: "👥 Invite" }]
            ],
            resize_keyboard: true
        }
    };

    bot.sendMessage(chatId, `🎮 **ወደ Yohans Bingo እንኳን ደህና መጡ!**`, mainKeyboard);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    if (!text || text.startsWith('/start')) return;

    if (!usersData[userId]) {
        usersData[userId] = { balance: 10.00, referrals: 0 };
    }

    if (text === "💳 My Balance") {
        bot.sendMessage(chatId, `💰 **የእርስዎ Wallet ሂሳብ:** ${usersData[userId].balance.toFixed(2)} ETB`);
    } else if (text === "📥 Deposit") {
        bot.sendMessage(chatId, `💳 **ገንዘብ ለማስገባት** አድሚኑን ያናግሩ።`);
    } else if (text === "👥 Invite") {
        const refLink = `https://t.me/yohansayele21bot?start=ref_${userId}`;
        bot.sendMessage(chatId, `👥 **የመጋበዣ ሊንክዎ:**\n🔗 ${refLink}`);
    }
});

// API: የተጠቃሚውን ሂሳብ ማወቂያ
app.get('/api/user-data/:userId', (req, res) => {
    const userId = req.params.userId;
    if (!usersData[userId]) {
        usersData[userId] = { balance: 10.00, referrals: 0 };
    }
    res.json({ balance: usersData[userId].balance });
});

// API: ካርድ መግዣና መጫወቻ
app.post('/api/play-card', (req, res) => {
    const { userId, stake, cardNumber } = req.body;

    if (!usersData[userId]) {
        usersData[userId] = { balance: 10.00, referrals: 0 };
    }

    if (usersData[userId].balance < stake) {
        return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });
    }

    usersData[userId].balance -= stake;
    return res.json({ 
        success: true, 
        newBalance: usersData[userId].balance,
        cardNumber: cardNumber
    });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`Bingo Server running on port ${PORT}`));
