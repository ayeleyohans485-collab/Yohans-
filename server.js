const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = '@Yohans12121';

const TelegramBotConstructor = TelegramBot.default || TelegramBot;
const bot = new TelegramBotConstructor(BOT_TOKEN, { polling: true });

const userData = {};

async function isUserInChannel(userId) {
    try {
        const member = await bot.getChatMember(CHANNEL_USERNAME, userId);
        return ['creator', 'administrator', 'member'].includes(member.status);
    } catch (e) {
        console.error('Channel check error:', e);
        return false;
    }
}

bot.onText(/\/start(?:is+ref_(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const referrerId = match ? match[1] : null;

    const isJoined = await isUserInChannel(userId);
    if (!isJoined) {
        return bot.sendMessage(
            chatId,
            `⚠️ **ቅድሚያ ቻናላችንን መቀላቀል አለብዎት!**\n\nእባክዎ প্রথমে አዚህ ቻናል ውስጥ በመግባት ቻናላችንን ይቀላቀሉ፡`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📢 Join Channel (የቻናል አገናኝ)', url: `https://t.me/${CHANNEL_USERNAME.replace('@', '')}` }]
                    ]
                }
            }
        );
    }

    let isNewUser = false;

    if (!userData[userId]) {
        isNewUser = true;
        userData[userId] = { balance: 10.00, referrals: 0, referredBy: null };

        if (referrerId && referrerId != userId && userData[referrerId]) {
            userData[userId].referredBy = referrerId;
            userData[referrerId].balance += 10.00;
            userData[referrerId].referrals += 1;

            bot.sendMessage(
                referrerId,
                `🎁 **አዲስ ጓደኛ ተመዝግቧል!**\n\nከእርስዎ ሊንክ በመነሳት **10.00 ETB** ወደ Wallet ኪስዎ ተጨምሯል።`,
                { parse_mode: 'Markdown' }
            );
        }
    }

    const webAppUrl = process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.id.repl.co` : 'https://yohans-vm77.onrender.com';

    const mainKeyboard = {
        reply_markup: {
            keyboard: [
                [{ text: '🎮 Open Yohans Bingo Mini App', web_app: { url: 'https://yohans-vm77.onrender.com' } }],
                [{ text: '💳 My Balance (የእኔ ሒሳብ)' }, { text: '💰 Deposit (ገንዘብ ያስገቡ)' }],
                [{ text: '👥 Invite (ጋብዝ)' }]
            ],
            resize_keyboard: true
        }
    };

    const welcomeMessage = isNewUser
        ? `🎉 **እንኳን ደህና መጡ ወደ Yohans Bingo መድረክ!**\n\n🎁 **10.00 ETB** የመመዝገቢያ ስጦታ ተበርክቶልዎታል!\n\n🎮 ወደ Yohans Bingo ጨዋታ እንኳን ደህና መጡ!`
        : `🎮 **እንኳን ደህና መጡ!**\n\nእባክዎ ከታች ያሉትን አማራጮች በመጠቀም ጨዋታውን ይጀምሩ።`;

    bot.sendMessage(chatId, welcomeMessage, mainKeyboard);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    if (text === '/start') return;

    const isJoined = await isUserInChannel(userId);
    if (!isJoined) {
        return bot.sendMessage(chatId, '⚠️ እባክዎ ከመጀመርዎ በፊት ቻናላችንን ይቀላቀሉ!');
    }

    if (!userData[userId]) {
        userData[userId] = { balance: 10.00, referrals: 0, referredBy: null };
    }

    if (text === '💳 My Balance (የእኔ ሒሳብ)') {
        bot.sendMessage(
            chatId,
            `💳 **የእርስዎ ሒሳብ (My Balance)**\n\n💵 ሒሳብዎ: **${userData[userId].balance.toFixed(2)} ETB**\n👥 የጋበዟቸው ሰዎች ቁጥር: **${userData[userId].referrals}**`,
            { parse_mode: 'Markdown' }
        );
    } 
    else if (text === '💰 Deposit (ገንዘብ ያስገቡ)') {
        bot.sendMessage(
            chatId,
            `💰 **የገንዘብ ማ정보 (Deposit Info)**\n\nገንዘብ ለማንቀሳቀስ ከዚህ በታች ባለው የቴሌብር/ባንክ ሒሳብ ያስገቡ:-\n\n📱 ስልክ ቁጥር: 0938331486\n👤 ስም: Yohans Ayele\n\nገንዘቡን ገቢ ካደረጉ በኋላ የደረሰኝ ስክሪንሾት (Screenshot) ወይም የተاملهክንች ቁጥር ለአድሚን ይላኩ::`,
            { parse_mode: 'Markdown' }
        );
    } 
    else if (text === '👥 Invite (ጋብዝ)') {
        try {
            const botInfo = await bot.getMe();
            const inviteLink = `https://t.me/${botInfo.username}?start=ref_${userId}`;
            bot.sendMessage(
                chatId,
                `👥 **የመረኛ ሊንክዎ (Invite Link)**\n\nይህን ሊንክ ለጓደኛዎችዎ ይላኩ! እርሰዎም ሆነ እሱዎ **10.00 ETB** ያገኛሉ::\n\nየጋበዟቸው ሰዎች ብዛት: ${userData[userId].referrals}\n\n🔗 የጋበዣዎ ሊንክ: \`${inviteLink}\``,
                { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '📤 Share Invite Link', url: `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent('Yohans Bingo ጨዋታ በመጫወት ገንዘብ ያግኙ!')}` }]] } }
            );
        } catch (e) {
            console.error(e);
        }
    }
});

app.post('/api/buy-card', (req, res) => {
    const { userId, totalCards, pricePerCard } = req.body;

    if (!userData[userId]) {
        return res.status(400).json({ success: false, message: 'User not found' });
    }

    const numberOfCards = parseInt(totalCards) || 200;
    const cardPrice = parseFloat(pricePerCard) || 10.00;

    const totalCost = numberOfCards * cardPrice;
    const commission = totalCost * 0.20;

    if (userData[userId].balance < totalCost) {
        return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    userData[userId].balance -= totalCost;

    res.json({
        success: true,
        balance: userData[userId].balance,
        totalCards: numberOfCards,
        totalCost: totalCost,
        commissionDeducted: commission,
        message: '200 cards processed at game start with 20% commission successfully!'
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Yohans Bingo Server running on port ${PORT}`);
});
    );
  } else if (text === "👥 Invite (ጋብዝ)") {
    try {
      const botInfo = await bot.getMe();
      const inviteLink = `https://t.me/${botInfo.username}?start=ref_${userId}`;
      const user = usersData[userId];
      bot.sendMessage(
        chatId,
        `👥 **የመጋበዣ ሊንክዎ:**\n${inviteLink}\n\n🎁 ይህን ሊንክ ለጓደኞችዎ ይላኩ! እርሶም ሆነ እነሱ **10.00 ETB** ያገኛሉ።\n\nየጋበዟቸው ሰዎች ብዛት: ${user.referrals}`
      );
    } catch (e) {
      console.error(e);
    }
  }
});

app.post('/api/buy-card', (req, res) => {
  const { userId, totalCards, pricePerCard } = req.body;

  if (!usersData[userId]) {
    return res.status(400).json({ success: false, message: "User not found" });
  }

  const numberOfCards = parseInt(totalCards) || 200;
  const cardPrice = parseFloat(pricePerCard) || 10.00;

  const totalCost = numberOfCards * cardPrice;
  const commission = totalCost * 0.20;

  if (usersData[userId].balance < totalCost) {
    return res.status(400).json({ success: false, message: "Insufficient balance for 200 cards" });
  }

  usersData[userId].balance -= totalCost;

  res.json({
    success: true,
    totalCards: numberOfCards,
    totalCost: totalCost,
    commissionDeducted: commission,
    newBalance: usersData[userId].balance,
    message: "200 cards processed at game start with 20% commission successfully!"
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Yohans Bingo Server running on port ${PORT}`));
