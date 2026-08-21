const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const BOT_TOKEN = process.env.BOT_TOKEN; 
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ዋናው የቦት ተግባር
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const webAppUrl = process.env.WEB_APP_URL || "https://yohans-bingo.onrender.com";
  
  bot.sendMessage(chatId, "👋 እንኳን ወደ Yohans Bingo በደህና መጡ! 🎮", {
    reply_markup: {
      keyboard: [[{ text: "🎮 Play Yohans Bingo", web_app: { url: webAppUrl } }]],
      resize_keyboard: true
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
