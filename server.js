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

// 1. Middleware እና Static Files ማስተናገጃ
app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// 2. ቦቱን Webhook በመጠቀም ማስነሳት
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// 3. Webhook URL ማዘጋጀት
const webhookUrl = `${WEB_APP_URL}/bot${BOT_TOKEN}`;
bot.setWebHook(webhookUrl).then(() => {
    console.log(`Webhook successfully set to: ${webhookUrl}`);
}).catch((err) => {
    console.error('Webhook set error:', err);
});

// ቴሌግራም መልእክት ሲልክ የሚቀበልበት Endpoint
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// 4. የተጠቃሚዎች ዳታቤዝ (In-Memory Storage)
const usersData = {};

// ቻናል የተቀላቀለ መሆኑን ማረጋገጫ Function
async function isUserInChannel(userId) {
    try {
        const member = await bot.getChatMember(CHANNEL_USERNAME, userId);
        return ['creator', 'administrator', 'member'].includes(member.status);
    } catch (e) {
        console.error('Channel check error:', e);
        return false;
    }
}

// 5. /start Command Handling
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
                        [{ text: "📢 Join Channel (ቻናል ይቀላቀሉ)", url: `https://t.me/${CHANNEL_USERNAME.replace('@', '')}` }]
                    ]
                },
                parse_mode: 'Markdown'
            }
        );
    }

    if (!usersData[userId]) {
        usersData[userId] = { balance: 10.00, referrals: 0, referredBy: referrerId };
        
        if (referrerId && usersData[referrerId]) {
            usersData[referrerId].balance += 10.00;
            usersData[referrerId].referrals += 1;
            bot.sendMessage(referrerId, `🎉 **አዲስ ሰው ገብቷል!** +10.00 ETB አግኝተዋል።`);
        }

        await bot.sendMessage(
            chatId,
            `🎉 **እንኳን ደህና መጡ ወደ Yohans Bingo መድረክ!**\n\n🎁 **10.00 ETB** የመመዝገቢያ ስጦታ ተበርክቶልዎታል!`,
            { parse_mode: 'Markdown' }
        );
    }

    const mainKeyboard = {
        reply_markup: {
            keyboard: [
                [{ text: "🎮 Open Yohans Bingo Mini App", web_app: { url: WEB_APP_URL } }],
                [{ text: "💳 My Balance (የእኔ ሂሳብ)" }, { text: "📥 Deposit (ገንዘብ ያስገቡ)" }],
                [{ text: "👥 Invite (ጋብዝ)" }]
            ],
            resize_keyboard: true
        }
    };

    bot.sendMessage(chatId, `🎮 **ወደ Yohans Bingo ጨዋታ እንኳን ደህና መጡ!**`, mainKeyboard);
});

// 6. የቦት ቁልፎች (Text Messages Handling)
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    if (!text || text.startsWith('/start')) return;

    if (!usersData[userId]) {
        usersData[userId] = { balance: 10.00, referrals: 0, referredBy: null };
    }

    if (text === "💳 My Balance (የእኔ ሂሳብ)") {
        bot.sendMessage(chatId, `💰 **የእርስዎ Wallet ሂሳብ:** ${usersData[userId].balance.toFixed(2)} ETB\n👥 **የጋበዟቸው ሰዎች:** ${usersData[userId].referrals}`);
    } else if (text === "📥 Deposit (ገንዘብ ያስገቡ)") {
        bot.sendMessage(chatId, `💳 **ገንዘብ ለማስገባት** እባክዎን አድሚኑን ያናግሩ።`);
    } else if (text === "👥 Invite (ጋብዝ)") {
        const refLink = `https://t.me/yohansayele21bot?start=ref_${userId}`;
        bot.sendMessage(chatId, `👥 **የመጋበዣ ሊንክዎ (Invite Link)**\n\nይህንን ሊንክ ለጓደኞችዎ ይላኩ! 10.00 ETB ያገኛሉ።\n\n🔗 ${refLink}`);
    }
});

// 7. Mini App Card Purchase API
app.post('/api/buy-card', (req, res) => {
    const { userId, price } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, message: 'የተጠቃሚ ID አልተገኘም!' });
    }

    if (!usersData[userId]) {
        usersData[userId] = { balance: 10.00, referrals: 0, referredBy: null };
    }

    if (usersData[userId].balance < price) {
        return res.status(400).json({ success: false, message: 'በቂ የገንዘብ መጠን የለዎትም!' });
    }

    usersData[userId].balance -= price;
    return res.json({ success: true, newBalance: usersData[userId].balance });
});

// 8. የ Mini App HTML ገጽ ማቅረቢያ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 9. ሰርቨሩን ማስነሳት
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bingo Server running on port ${PORT}`);
});
