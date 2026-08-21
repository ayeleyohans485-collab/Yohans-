const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');

// 1. Bot Configuration (ቶከኑ በቀጥታ እዚህ ገብቷል)
const token = 'YOUR_BOT_TOKEN_HERE'; 
const CHANNEL_USERNAME = '@Yohans12121'; 

const bot = new TelegramBot(token, { polling: true });
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Real Bingo Bot Server running on port ${PORT}`);
});

// የጨዋታ መረጃዎችን መያዣ (Active Games State)
const activeGames = {};

// 2. Main Keyboard
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

// 3. /start Command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const welcomeText = `🎉 **እንኳን ደህና መጡ ወደ እውነተኛው የቢንጎ ጨዋታ ቦት!** 🎉\n\nከታች ባሉት አማራጮች ጨዋታውን መጀመር ወይም ሚኒ አፑን መክፈት ይችላሉ።`;

    await bot.sendMessage(chatId, welcomeText, {
        ...mainKeyboard,
        parse_mode: 'Markdown'
    });
});

// 4. Message Handlers for Game Actions
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/start')) return;

    if (text === '🎲 አዲስ ቢንጎ ጀምር (Start Bingo)') {
        // ከ 1 እስከ 75 ያሉ ቁጥሮችን ማዘጋጀት
        let numbers = Array.from({ length: 75 }, (_, i) => i + 1);
        // ቁጥሮቹን መቀላቀል (Shuffle)
        numbers.sort(() => Math.random() - 0.5);

        activeGames[chatId] = {
            numbers: numbers,
            calledNumbers: [],
            isGameActive: true
        };

        await bot.sendMessage(chatId, `🎲 **የቢንጎ ጨዋታ ተጀመረ!**\n\nቁጥሮች መውጣት ጀምረዋል። ቀጣዩን ቁጥር ለማየት ከታች ያለውን ይጫኑ።`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'nextToken ➡️ ቁጥር አውጣ', callback_data: 'call_number' }],
                    [{ text: '🛑 ጨዋታውን አቁም', callback_data: 'stop_game' }]
                ]
            }
        });
    }
    else if (text === '💳 ሒሳቤ (Balance)') {
        await bot.sendMessage(chatId, `💰 የባንክ ሒሳብዎ: **10.00 ETB**`, { ...mainKeyboard, parse_mode: 'Markdown' });
    }
    else if (text === '👥 ጓደኛ ጋብዝ (Invite)') {
        const inviteLink = `https://t.me/yohansayele21bot?start=ref_${chatId}`;
        await bot.sendMessage(chatId, `👥 **የጋበዣ ሊንክዎ (Invite Link)**\n\n${inviteLink}\n\nይህን ለጓደኛ በመላክ ይሸለሙ!`, mainKeyboard);
    }
});

// 5. Callback Query Handler (ለ ቁጥር ማውጫ ቁልፎች)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    if (!activeGames[chatId] || !activeGames[chatId].isGameActive) {
        await bot.answerCallbackQuery(query.id, { text: 'እባክዎ መጀመሪያ ጨዋታ ይጀምሩ!' });
        return;
    }

    let game = activeGames[chatId];

    if (data === 'call_number') {
        if (game.numbers.length === 0) {
            await bot.answerCallbackQuery(query.id, { text: 'ሁሉም ቁጥሮች አልቀዋል!' });
            return;
        }

        let currentNum = game.numbers.pop();
        game.calledNumbers.push(currentNum);

        let responseText = `🎲 **የወጣው ቁጥር:** \n\n🔹 **${currentNum}**\n\n📋 **የወጡ ቁጥሮች ዝርዝር:** ${game.calledNumbers.join(', ')}`;

        await bot.editMessageText(responseText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'nextToken ➡️ ሌላ ቁጥር አውጣ', callback_data: 'call_number' }],
                    [{ text: '🛑 ጨዋታውን አቁም', callback_data: 'stop_game' }]
                ]
            }
        });

        await bot.answerCallbackQuery(query.id);
    } 
    else if (data === 'stop_game') {
        delete activeGames[chatId];
        await bot.editMessageText(`🛑 **ጨዋታው ተቋርጧል!**`, {
            chat_id: chatId,
            message_id: messageId
        });
        await bot.answerCallbackQuery(query.id, { text: 'ጨዋታው ቆሟል' });
    }
});
