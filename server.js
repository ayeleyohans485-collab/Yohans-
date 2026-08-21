require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const connectDB = require('./config/db');

// ዳታቤዝ ማገናኘት
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'miniapp')));

// ሪል-ታይም ቁጥር ጥሪ ሞተር (Socket.io)
io.on('connection', (socket) => {
    console.log('User connected to Yohans Bingo room:', socket.id);

    socket.on('start_game_room', () => {
        let calledNumbers = [];
        const interval = setInterval(() => {
            if (calledNumbers.length >= 75) {
                clearInterval(interval);
                return;
            }
            let randomNum;
            do {
                randomNum = Math.floor(Math.random() * 75) + 1;
            } while (calledNumbers.includes(randomNum));

            calledNumbers.push(randomNum);
            io.emit('number_called', { number: randomNum, allCalled: calledNumbers });
        }, 5000);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// የቴሌግራም ቦቱን ማስጀመር
require('./index');

server.listen(PORT, () => {
    console.log(`Yohans Bingo Server is running on port ${PORT}`);
});
