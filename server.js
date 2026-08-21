require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');

// ዳታቤዝ ማገናኛ እና ዩዘር ሞዴል በቀጥታ እዚህ ተካትቷል
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected successfully!'))
.catch((err) => console.error('MongoDB Connection Error:', err));

const userSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    firstName: { type: String },
    mainWallet: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'miniapp')));

// የሚኒ አፕ (Mini App) API - ለጨዋታ ክፍያ እና ሽልማት
app.post('/api/play', async (req, res) => {
    try {
        const { telegramId, betAmount } = req.body;
        const user = await User.findOne({ telegramId });
        if (user && user.mainWallet >= betAmount) {
            user.mainWallet -= betAmount;
            await user.save();
            res.json({ success: true, newBalance: user.mainWallet });
        } else {
            res.json({ success: false, message: 'በቂ ብር የለዎትም!' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'ሰርቨር ስህተት አጋጥሟል' });
    }
});

app.post('/api/win', async (req, res) => {
    try {
        const { telegramId, prize } = req.body;
        const user = await User.findOneAndUpdate(
            { telegramId }, 
            { $inc: { mainWallet: prize } },
            { new: true }
        );
        res.json({ success: true, newBalance: user ? user.mainWallet : 0 });
    } catch (err) {
        res.status(500).json({ success: false, message: 'ሰርቨር ስህተት አጋጥሟል' });
    }
});

// የሪል-ታይም ቁጥር ጥሪ ሞተር (Socket.io)
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

server.listen(PORT, () => console.log(`Yohans Bingo Server running on port ${PORT}`));
