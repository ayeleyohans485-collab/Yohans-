const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');

// ቶከኑን ከ Render Environment Variables ላይ ብቻ ይወስዳል
const token = process.env.BOT_TOKEN;

if (!token) {
    console.error("Critical Error: BOT_TOKEN is not set in Render Environment!");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Bingo Bot Server is running on port ${PORT}`);
});

const activeGames = {};

const mainKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '🎮 Open Bingo Mini App', web_app: { url: 'https://yohans-vn77.onrender.com' } }],
            [{ text: '🎲 አዲስ ቢንጎ ጀምር (Start Bingo)' }, { text: '💳 ሒሳቤ (Balance)' }],
            [{ text: '👥 ጓደኛ ጋብዝ (Invite)' }]
        ],
        resize_keyboard: true
    }
};

bot.onText(/\/start/, async (msg) => {
    await bot.sendMessage(msg.chat.id, `🎉 **እንኳን ደህና መጡ ወደ Yohans Bingo!** 🎉`, {
        ...mainKeyboard,
        parse_mode: 'Markdown'
    });
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/start')) return;

    if (text === '🎲 አዲስ ቢንጎ ጀምር (Start Bingo)') {
        let numbers = Array.from({ length: 75 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
        activeGames[chatId] = { numbers, calledNumbers: [], isGameActive: true };

        await bot.sendMessage(chatId, `🎲 **ጨዋታው ተጀመረ!**`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '➡️ ቁጥር አውጣ', callback_data: 'call_number' }],
                    [{ text: '🛑 ጨዋታውን አቁም', callback_data: 'stop_game' }]
                ]
            }
        });
    }
    else if (text === '💳 ሒሳቤ (Balance)') {
        await bot.sendMessage(chatId, `💰 ሒሳብዎ: 10.00 ETB`, mainKeyboard);
    }
    else if (text === '👥 ጓደኛ ጋብዝ (Invite)') {
        await bot.sendMessage(chatId, `🔗 የጋበዣ ሊንክዎ: https://t.me/yohansayele21bot?start=ref_${chatId}`, mainKeyboard);
    }
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    if (query.data === 'call_number' && activeGames[chatId]) {
        let num = activeGames[chatId].numbers.pop();
        activeGames[chatId].calledNumbers.push(num);
        await bot.editMessageText(`🎲 የወጣው ቁጥር: ${num}\n📋 የወጡ: ${activeGames[chatId].calledNumbers.join(', ')}`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
                inline_keyboard: [[{ text: '➡️ ሌላ ቁጥር', callback_data: 'call_number' }], [{ text: '🛑 አቁም', callback_data: 'stop_game' }]]
            }
        });
    } else if (query.data === 'stop_game') {
        delete activeGames[chatId];
        await bot.editMessageText(`🛑 ጨዋታው ቆሟል!`, { chat_id: chatId, message_id: query.message.message_id });
    }
    bot.answerCallbackQuery(query.id);
});
