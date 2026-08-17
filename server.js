const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
    console.error("Error: BOT_TOKEN is not set in environment variables!");
    process.exit(1);
}

// 1. Mini App ፋይሎችን የሚያስተናግድ (Not Found ችግርን ይፈታል)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 2. ቦቱን ማስነሻ
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// 3. Webhook Conflict ችግርን ለመፍታት (409 Error)
bot.deleteWebHook();

// 4. ለ Mini App መክፈቻ የሚሆን Route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 5. ዋናው የቦት Logic
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "እንኳን ወደ Yohans Bingo በደህና መጡ! 🎮", {
        reply_markup: {
            inline_keyboard: [[
                { text: "🎮 Open Bingo Mini App", web_app: { url: "https://yohans-xm77.onrender.com" } }
            ]]
        }
    });
});

// 6. ሰርቨሩን ማስነሻ
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bingo Server is running on port ${PORT}`);
});
