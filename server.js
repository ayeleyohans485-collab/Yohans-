const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');

// 1. Bot Configuration
const token = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = '@Yohans12121'; 

if (!token) {
    console.error("Error: BOT_TOKEN is missing in environment variables!");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple Web Server Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`Yohans Bingo Server running on port ${PORT}`);
});

// 2. Main Keyboard Definition
const mainKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '🎮 Open Yohans Bingo Mini App', web_app: { url: 'https://yohans-vn77.onrender.com' } }],
            [{ text: '💳 My Balance (የእኔ ሒሳብ)' }, { text: '💰 Deposit (ገንዘብ ለማስገባት)' }],
            [{ text: '👥 Invite (ጋብዝ)' }]
        ],
        resize_keyboard: true
    }
};

// 3. /start Command Handler
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'ወዳጅ';

    const welcomeMessage = `🎉 **እንኳን ደህና መጡ ወደ Yohans Bingo መድረክ!** 🎉\n\nእዚህጋር እየተጫወቱ ሽልማቶችን ማሸነፍ ይችላሉ!`;

    await bot.sendMessage(chatId, welcomeMessage, {
        ...mainKeyboard,
        parse_mode: 'Markdown'
    });
});

// 4. Text Messages Handler
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/start')) return;

    if (text === '💳 My Balance (የእኔ ሒሳብ)') {
        await bot.sendMessage(chatId, `💰 የድርጅት Wallet ሒሳብ: 10.00 ETB\n👥 የጋበዟቸው ሰዎች ብዛት: 0`, mainKeyboard);
    } 
    else if (text === '💰 Deposit (ገንዘብ ለማስገባት)') {
        await bot.sendMessage(chatId, `📥 ገንዘብ ለማስገባት በውስጥ መስመር ያነጋግሩን።`, mainKeyboard);
    } 
    else if (text === '👥 Invite (ጋብዝ)') {
        const inviteLink = `https://t.me/yohansayele21bot?start=ref_${chatId}`;
        await bot.sendMessage(chatId, `👥 **የመልዕክተኛ ሊንክ (Invite Link)**\n\nይህን ሊንክ ለጓደኞችዎ ይላኩ! እርሰዎም ሆነ ጓደኛዎ 10.00 ETB ያገኛሉ::\n\n🔗 የጋበዣዎ ሊንክ: ${inviteLink}`, {
            ...mainKeyboard,
            parse_mode: 'Markdown'
        });
    }
});
