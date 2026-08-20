const { Telegraf } = require('telegraf');

// እዚህ ጋር የቦትህን ቶክን (Bot Token) አስገባ
const bot = new Telegraf('YOUR_TELEGRAM_BOT_TOKEN');

bot.start((ctx) => {
    ctx.reply('👋 እንቋዕ ወደ የቤተሰብ 5x5 ቢንጎ ሰላም መጡ! 10 ETB ቦነስ ተሰጥቶታል። ለመጫወት ከታች ያለውን ፋፋ ይጫኑ።', {
        reply_markup: {
            inline_keyboard: [
                [
                    { 
                        text: '🎮 Open Yohans Bingo Mini App', 
                        web_app: { url: 'https://yohans-vn77.onrender.com' } 
                    }
                ]
            ]
        }
    });
});

bot.launch();
console.log('Telegram Bot started successfully! 🤖');
