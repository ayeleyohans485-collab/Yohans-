const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// የተጠቃሚዎች ሂሳብ መያዣ
let users = {};

// የሰርቨር ታይመር (በየ 30 ሰከንዱ የሚዞር)
const ROUND_TIME = 30; 
let startTime = Date.now();

// የቀረውን ሰዓት ከሰርቨር ማስያዣ
function getRemainingTime() {
    let elapsed = Math.floor((Date.now() - startTime) / 1000);
    let remaining = ROUND_TIME - (elapsed % ROUND_TIME);
    return remaining;
}

// የሰዓት መረጃ መቀበያ API
app.get('/api/game-status', (req, res) => {
    res.json({ remainingTime: getRemainingTime() });
});

// የተጠቃሚ መረጃ መቀበያ API
app.get('/api/user-data/:userId', (req, res) => {
    const uid = req.params.userId;
    if (!users[uid]) {
        users[uid] = { balance: 100 }; // የመነሻ ቦነስ
    }
    res.json(users[uid]);
});

// ጨዋታ መጫወቻ API
app.post('/api/play-card', (req, res) => {
    const { userId, stake, cardNumber } = req.body;
    
    if (!users[userId]) {
        users[userId] = { balance: 100 };
    }

    if (users[userId].balance < stake) {
        return res.json({ success: false, message: "በቂ የሂሳብ መጠን የለዎትም!" });
    }

    // ሂሳብ መቀነስ
    users[userId].balance -= stake;

    res.json({
        success: true,
        newBalance: users[userId].balance
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
