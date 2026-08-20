const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Telegraf } = require('telegraf');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// ─── 1. የቴሌግራም ቦት ማዋቀር ───
// 'YOUR_TELEGRAM_BOT_TOKEN' በሚለው ቦታ የቦትህን ቶክን አስገባ
const bot = new Telegraf(8897205610:AAF_4qBaDglOpUbS9H7P11GRk1fpt3GCQSc);

bot.start((ctx) => {
    ctx.reply('👋 እንቋዕ ወደ ዮሐንስ ቢንጎ ሰላም መጡ! 10 ETB ቦነስ ተሰጥቶታል። ለመጫወት ከታች ያለውን ይጫኑ።', {
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

bot.launch().then(() => {
    console.log('Telegram Bot started successfully! 🤖');
}).catch((err) => {
    console.error('Telegram bot failed to start:', err);
});

// ─── 2. የቢንጎ ጨዋታ ሰርቨር ሎጂክ (Socket.io) ───
let gameState = 'WAITING'; // WAITING, PLAYING, WON
let countdown = 45;
let calledNumbers = [];
let availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
let currentNumber = null;
let lastWinner = null;
let winningCartela = null;
let playersCount = 0;

setInterval(() => {
    if (gameState === 'WAITING') {
        countdown--;
        if (countdown <= 0) {
            startNewGame();
        }
        io.emit('gameState', getGameStateData());
    } else if (gameState === 'PLAYING') {
        if (availableNumbers.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableNumbers.length);
            currentNumber = availableNumbers.splice(randomIndex, 1)[0];
            calledNumbers.push(currentNumber);
            
            io.emit('numberCalled', {
                number: currentNumber,
                calledNumbers: calledNumbers
            });
        } else {
            startNewGame();
        }
    }
}, 3000); // በየ 3 ሰከንድ አንድ ቁጥር ይወጣል

function startNewGame() {
    gameState = 'PLAYING';
    calledNumbers = [];
    availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
    currentNumber = null;
    lastWinner = null;
    winningCartela = null;
    io.emit('gameStarted', getGameStateData());
}

function getGameStateData() {
    return {
        gameState,
        countdown,
        calledNumbers,
        currentNumber,
        lastWinner,
        winningCartela,
        playersCount
    };
}

io.on('connection', (socket) => {
    playersCount++;
    io.emit('playerCount', playersCount);
    
    socket.emit('gameState', getGameStateData());

    socket.on('bingoClaim', (data) => {
        gameState = 'WON';
        lastWinner = data.username || "ዮሐንስ ተጫዋች";
        winningCartela = data.cartelaId || 64;
        
        io.emit('gameOver', {
            winner: lastWinner,
            cartelaId: winningCartela,
            winningNumbers: data.winningNumbers
        });

        setTimeout(() => {
            countdown = 45;
            gameState = 'WAITING';
            startNewGame();
        }, 7000);
    });

    socket.on('disconnect', () => {
        playersCount = Math.max(0, playersCount - 1);
        io.emit('playerCount', playersCount);
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Yohans Bingo Server running on port ${PORT} 🚀`);
});
