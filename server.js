const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');

const token = process.env.BOT_TOKEN;
if (!token) {
    console.error("Critical Error: BOT_TOKEN is not set in Render Environment!");
    process.exit(1);
}

// 409 Conflict እንዳይፈጠር webhookን በማጥፋት ፖሊንግን ማስጀመር
const bot = new TelegramBot(token, { polling: false });

async function startBot() {
    try {
        await bot.deleteWebHook();
        console.log("Old webhooks cleared successfully.");
        
        // ፖሊንግን እንደገና ማስጀመር
        bot.startPolling();
        console.log("Telegram Bot polling started successfully.");
    } catch (error) {
        console.error("Error starting bot polling:", error.message);
    }
}

startBot();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Real Bingo Bot Server is running on port ${PORT}`);
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
    await bot.sendMessage(msg.chat.id, `🎉 **እንኳን ደህና መጡ ወደ Yohans Beteseb Bingo!** 🎉\n\nከታች ባሉት አማራጮች ጨዋታውን ይጀምሩ።`, {
        ...mainKeyboard,
        parse_mode: 'Markdown'
    });
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/start')) return;

    if (text === '🎲 አዲስ ቢንጎ ጀምር (Start Bingo)') {
        let numbers = Array.from({ length: 75 }, (_, i) => i + 1);
        numbers.sort(() => Math.random() - 0.5);

        activeGames[chatId] = {
            numbers: numbers,
            calledNumbers: [],
            isGameActive: true
        };

        await bot.sendMessage(chatId, `🎲 **የቤተሰብ ቢንጎ ጨዋታ ተጀመረ!**\n\nቁጥሮች መውጣት ጀምረዋል። ቁጥር ለማውጣት ከታች ያለውን ይጫኑ።`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'ማውጫ ➡️ nextToken (ቁጥር አውጣ)', callback_data: 'call_number' }],
                    [{ text: '🛑 ጨዋታውን አቁም', callback_data: 'stop_game' }]
                ]
            }
        });
    }
    else if (text === '💳 ሒሳቤ (Balance)') {
        await bot.sendMessage(chatId, `💰 የባንክ ሒሳብዎ: **10.00 ETB**`, { ...mainKeyboard, parse_mode: 'Markdown' });
    }
    else if (text === '👥 ጓደኛ ጋብዝ (Invite)') {
        await bot.sendMessage(chatId, `🔗 የጋበዣ ሊንክዎ: https://t.me/yohansayele21bot?start=ref_${chatId}`, mainKeyboard);
    }
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    if (!activeGames[chatId] || !activeGames[chatId].isGameActive) {
        await bot.answerCallbackQuery(query.id, { text: 'እባክዎ መጀመሪያ አዲስ ቢንጎ ይጀምሩ!' });
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

        let responseText = `🎲 **የወጣው ቁጥር:**\n\n🔹 **${currentNum}**\n\n📋 **የወጡ ቁጥሮች ዝርዝር:**\n${game.calledNumbers.join(', ')}`;

        await bot.editMessageText(responseText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'ማውጫ ➡️ nextToken (ሌላ ቁጥር አውጣ)', callback_data: 'call_number' }],
                    [{ text: '🛑 ጨዋታውን አቁም', callback_data: 'stop_game' }]
                ]
            }
        });

        await bot.answerCallbackQuery(query.id);
    } 
    else if (data === 'stop_game') {
        delete activeGames[chatId];
        await bot.editMessageText(`🛑 **የቢንጎ ጨዋታው ተቋርጧል!**`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        });
        await bot.answerCallbackQuery(query.id, { text: 'ጨዋታው ቆሟል' });
    }
});
