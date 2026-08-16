const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = '@Yohans12121';

const TelegramBotConstructor = TelegramBot.default || TelegramBot;
const bot = new TelegramBotConstructor(BOT_TOKEN, { 
  polling: {
    params: {
      drop_pending_updates: true
    }
  } 
});

const usersData = {};

async function isUserInChannel(userId) {
  try {
    const member = await bot.getChatMember(CHANNEL_USERNAME, userId);
    return ['creator', 'administrator', 'member'].includes(member.status);
  } catch (e) {
    console.error('Channel check error:', e);
    return false;
  }
}

bot.onText(/\/start(?:\s+ref_(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const referrerId = match ? match[1] : null;

  const isJoined = await isUserInChannel(userId);
  if (!isJoined) {
    return bot.sendMessage(
      chatId,
      `⚠️ **ቦቱን ለመጠቀም አስቀድመው ቻናላችንን መቀላቀል አለብዎት!**\n\nእባክዎን ከታች ያለውን ሊንክ ተጭነው ቻናሉን ከተቀላቀሉ በኋላ እንደገና **/start** ይበሉ።`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Join Channel (ቻናል ይቀላቀሉ)", url: `https://t.me/${CHANNEL_USERNAME.replace('@', '')}` }]
          ]
        }
      }
    );
  }

  let isNewUser = false;

  if (!usersData[userId]) {
    usersData[userId] = { balance: 10.00, referrals: 0, referredBy: null };
    isNewUser = true;

    if (referrerId && referrerId != userId && usersData[referrerId]) {
      usersData[userId].referredBy = referrerId;
      usersData[referrerId].balance += 10.00;
      usersData[referrerId].referrals += 1;

      bot.sendMessage(
        referrerId,
        `🎉 **አዲስ ተጋባዥ ተቀላቅሏል!**\n\nለጓደኛዎ ጥያቄ በመላክዎ **10.00 ETB** ወደ Walletዎ ተጨምሯል!`
      );
    }
  }

  const webAppUrl = process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : "https://example.com";

  const mainKeyboard = {
    reply_markup: {
      keyboard: [
        [{ text: "🎮 Open Yohans Bingo Mini App", web_app: { url: webAppUrl } }],
        [{ text: "💳 My Balance (የእኔ ሂሳብ)" }, { text: "📥 Deposit (ገንዘብ ያስገቡ)" }],
        [{ text: "👥 Invite (ጋብዝ)" }]
      ],
      resize_keyboard: true
    }
  };

  const welcomeMessage = isNewUser
    ? `🎁 *እንኳን ወደ Yohans Bingo በደህና መጡ!* 🎮\n\n🎁 **የ 10.00 ETB የመመዝገቢያ ቦነስ** ተሰጥቶዎታል!\n\nጓደኞችን በመጋበዝ ተጨማሪ **10.00 ETB** ማግኘት ይችላሉ።`
    : `እንኳን ወደ Yohans Bingo ተመልሰው መጡ! 🎮`;

  bot.sendMessage(chatId, welcomeMessage, mainKeyboard);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith('/start')) return;

  const isJoined = await isUserInChannel(userId);
  if (!isJoined) {
    return bot.sendMessage(chatId, `⚠️ እባክዎን አስቀድመው ቻናላችንን ይቀላቀሉ: ${CHANNEL_USERNAME}`);
  }

  if (!usersData[userId]) {
    usersData[userId] = { balance: 10.00, referrals: 0, referredBy: null };
  }

  if (text === "💳 My Balance (የእኔ ሂሳብ)") {
    const user = usersData[userId];
    bot.sendMessage(
      chatId,
      `💰 **የእርስዎ Wallet ሂሳብ:** ${user.balance.toFixed(2)} ETB\n👥 **የጋበዟቸው ሰዎች:** ${user.referrals}`,
      { parse_mode: 'Markdown' }
    );
  } else if (text === "📥 Deposit (ገንዘብ ያስገቡ)") {
    bot.sendMessage(
      chatId,
      `📥 **የዲፓዚት መረጃ (Deposit Info)**\n\nገንዘብ ለማስገባት ከታች ባለው የቴሌብር/ባንክ ሂሳብ ያስገቡ፦\n\n📱 **ስልክ ቁጥር:** \`0938331486\`\n👤 **ስም:** Yohans Ayele\n\nገንዘቡን ገቢ ካደረጉ በኋላ የደረሰኝ ስክሪንሾት (Screenshot) ወይም የትራንዛክሽን ቁጥር ለአድሚን ይላኩ።`,
      { parse_mode: 'Markdown' }
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
