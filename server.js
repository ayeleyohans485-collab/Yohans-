const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');

const token = process.env.BOT_TOKEN;
if (!token) {
    console.error("Critical Error: BOT_TOKEN is not set in Render Environment!");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: false });

async function startBot() {
    try {
        await bot.deleteWebHook();
        console.log("Old webhooks cleared successfully.");
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

// የንቁ ጨዋታዎች ማከማቻ
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
    await bot.sendMessage(msg.chat.id, `🎉 **እንኳን ደህና መጡ ወደ Yohans Beteseb Bingo!** 🎉\n\nእውነተኛውን የቢንጎ ጨዋታ ከታች ባሉት አማራጮች ይጀምሩ።`, {
        ...mainKeyboard,
        parse_mode: 'Markdown'
    });
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/start')) return;

    if (text === '🎲 አዲስ ቢንጎ ጀምር (Start Bingo)') {
        // ከ 1 እስከ 75 ያሉ ቁጥሮችን ማዘጋጀት እና መቀላቀል
        let numbers = Array.from({ length: 75 }, (_, i) => i + 1);
        numbers.sort(() => Math.random() - 0.5);

        activeGames[chatId] = {
            numbers: numbers,
            calledNumbers: [],
            isGameActive: true,
            timer: null
        };

        let game = activeGames[chatId];

        await bot.sendMessage(chatId, `🎲 **የቤተሰብ ቢንጎ ጨዋታ ተጀመረ!**\n\nቁጥሮች በራሳቸው በየ 6 ሰኮንዱ መውጣት ጀመረዋል!`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🛑 ጨዋታውን አቁም', callback_data: 'stop_game' }]
                ]
            }
        });

        // አውቶማቲክ ቁጥር ማውጫ ሎፕ (Auto-draw every 6 seconds)
        game.timer = setInterval(async () => {
            if (!activeGames[chatId] || !activeGames[chatId].isGameActive) {
                clearInterval(game.timer);
                return;
            }

            if (game.numbers.length === 0) {
                clearInterval(game.timer);
                await bot.sendMessage(chatId, `🏁 **ጨዋታው አልቋል!** ሁሉም ቁጥሮች ተጠርተዋል።`);
                delete activeGames[chatId];
                return;
            }

            let currentNum = game.numbers.pop();
            game.calledNumbers.push(currentNum);

            let responseText = `🎲 **የወጣው ቁጥር:**\n\n🔹 **${currentNum}**\n\n📋 **የወጡ ቁጥሮች (${game.calledNumbers.length}/75):**\n${game.calledNumbers.join(', ')}`;

            try {
                await bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
            } catch (err) {
                console.error("Error sending number:", err.message);
            }
        }, 6000);
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

    if (data === 'stop_game') {
        if (activeGames[chatId]) {
            clearInterval(activeGames[chatId].timer);
            delete activeGames[chatId];
        }
        await bot.editMessageText(`🛑 **የቢንጎ ጨዋታው ተቋርጧል!**`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        });
        await bot.answerCallbackQuery(query.id, { text: 'ጨዋታው ቆሟል' });
    }
});
