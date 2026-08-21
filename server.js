const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');
const fs = require('fs');

const token = process.env.BOT_TOKEN;
if (!token) {
    console.error("Critical Error: BOT_TOKEN is not set in environment variables!");
    process.exit(1);
}

const URL = 'https://yohans-vn77.onrender.com';
const bot = new TelegramBot(token);
const app = express();
const PORT = process.env.PORT || 10000;

// Database ፋይል (የተጠቃሚዎችን ሂሳብ እና መረጃ ለመያዝ)
const DB_FILE = path.join(__dirname, 'db.json');
let db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : { users: {}, history: [] };

function saveDb() { 
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); 
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// የቴሌግራም ዌብሆክ (Webhook) መቀበያ
app.post(`/bot${token}`, (req, res) => { 
    bot.processUpdate(req.body); 
    res.sendStatus(200); 
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, async () => {
    console.log(`Yohans Bingo Server running on port ${PORT}`);
    try {
        await bot.setWebHook(`${URL}/bot${token}`);
        console.log("Webhook successfully set.");
    } catch (err) {
        console.error("Webhook error:", err.message);
    }
});

// የቦት ዋና ሜኑ አዝራሮች (እንደ Beteseb Bingo አቀማመጥ)
const mainKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '🎮 Play', web_app: { url: URL } }, { text: 'Register 📝' }],
            [{ text: 'Check Balance 💰' }, { text: 'Deposit 💳' }],
            [{ text: 'Contact Support 📞' }, { text: 'Instruction 📖' }],
            [{ text: 'Transfer 💸' }, { text: 'Withdraw 🏦' }]
        ],
        resize_keyboard: true
    }
};

// /start ትዕዛዝ
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    if (!db.users[chatId]) {
        db.users[chatId] = { balance: 0, gamesPlayed: 0, wins: 0 };
        saveDb();
    }
    
    bot.sendMessage(chatId, `🎉 **Welcome to Yohans Bingo!** \n\nእባክዎ ከታች ከሚገኙት አማራጮች የሚፈልጉትን ይምረጡ።`, {
        ...mainKeyboard,
        parse_mode: 'Markdown'
    });
});

// የመልእክቶች እና የአዝራሮች ምላሽ
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/start')) return;

    if (!db.users[chatId]) {
        db.users[chatId] = { balance: 0, gamesPlayed: 0, wins: 0 };
        saveDb();
    }

    if (text === 'Check Balance 💰') {
        bot.sendMessage(chatId, `💰 Your current balance: **${db.users[chatId].balance} ETB**`, { 
            ...mainKeyboard, 
            parse_mode: 'Markdown' 
        });
    } 
    else if (text === 'Deposit 💳') {
        bot.sendMessage(chatId, `💳 **ሂሳብ ለመሙላት:**\n\nእባክዎ የሚፈልጉትን ገንዘብ ከታች ባለው አካውንት ያስገቡ:\n\n📱 **ስልክ ቁጥር:** 0938331486\n👤 **ስም:** Yohans Ayele\n\nከፍለው ሲጨርሱ የግብይት ማረጋገጫ ቁጥርዎን (Transaction Code) በዚህ ቦት ላይ ይላኩልን።`, { 
            ...mainKeyboard, 
            parse_mode: 'Markdown' 
        });
    }
    else if (text === 'Register 📝') {
        bot.sendMessage(chatId, `✅ **Player registered successfully!**\nአሁን ጨዋታውን መጀመር ይችላሉ።`, { 
            ...mainKeyboard, 
            parse_mode: 'Markdown' 
        });
    }
    else if (text === 'Instruction 📖') {
        bot.sendMessage(chatId, `📖 **የጨዋታ መመሪያ:**\n1. 🎮 Play የሚለውን በመጫን ሚኒ አፑን ይክፈቱ።\n2. 💳 ሒሳብ በመሙላት ካርቴላ ይግዙ።\n3. ቁጥሮች ሲጠሩ እየተከታተሉ ቢንጎ ይበሉ።`, { 
            ...mainKeyboard, 
            parse_mode: 'Markdown' 
        });
    }
    else if (text === 'Contact Support 📞') {
        bot.sendMessage(chatId, `📞 **የዕርዳታ ማዕከል (Support):**\nማንኛውም ችግር ሲያጋጥብዎት ከዚህ በታች ባለው አድራሻ ያግኙን:\n📱 0938331486 (Yohans Ayele)`, { 
            ...mainKeyboard, 
            parse_mode: 'Markdown' 
        });
    }
    else if (text === 'Transfer 💸') {
        bot.sendMessage(chatId, `💸 ገንዘብ ለሌላ ተጠቃሚ ለማስተላለፍ የሚፈልጉትን መለያ (User ID) እና መጠን ይላኩ።`, { 
            ...mainKeyboard, 
            parse_mode: 'Markdown' 
        });
    }
    else if (text === 'Withdraw 🏦') {
        bot.sendMessage(chatId, `🏦 ከሂሳብዎ ገንዘብ ለማውጣት የባንክ አካውንት ቁጥርዎን ይላኩ።`, { 
            ...mainKeyboard, 
            parse_mode: 'Markdown' 
        });
    }
    else if (text.length >= 6 && !text.startsWith('/')) {
        db.users[chatId].balance += 300;
        saveDb();
        bot.sendMessage(chatId, `✅ **Deposit Approved!**\n300 ETB ወደ ሒሳብዎ ገብቷል። አሁን ያለው ጠቅላላ ሒሳብ: **${db.users[chatId].balance} ETB**`, { 
            ...mainKeyboard, 
            parse_mode: 'Markdown' 
        });
    }
});
