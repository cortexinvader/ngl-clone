const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const TelegramBot = require('node-telegram-bot-api');
const multer = require('multer');
const { Expo } = require('expo-server-sdk');
const fs = require('fs');
const path = require('path');

const app = express();
const expo = new Expo();

// --- CONFIG ---
const PORT = 3000;
// REPLACE THESE WITH YOUR REAL DATA
const TELEGRAM_TOKEN = "YOUR_BOT_TOKEN_HERE"; 
const TELEGRAM_CHAT_ID = "YOUR_CHAT_ID_HERE";
const DB_PATH = './database.sqlite';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    theme_id INTEGER DEFAULT 0,
    avatar_id INTEGER DEFAULT 0,
    push_token TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_id INTEGER,
    type TEXT, 
    content TEXT,
    game_mode TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

async function sendPush(token, message) {
  if (!Expo.isExpoPushToken(token)) return;
  const chunks = expo.chunkPushNotifications([{
    to: token, sound: 'default', title: 'New Txtme Message! 👻', body: message
  }]);
  for (let chunk of chunks) {
    try { await expo.sendPushNotificationsAsync(chunk); } catch (e) { console.error(e); }
  }
}

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash], function(err) {
    if (err) return res.status(400).json({ error: "Username taken" });
    res.json({ id: this.lastID, username });
  });
});

app.post('/login', (req, res) => {
  const { username, password, pushToken } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    if (pushToken) db.run(`UPDATE users SET push_token = ? WHERE id = ?`, [pushToken, user.id]);
    res.json(user);
  });
});

app.get('/u/:username', (req, res) => {
  db.get(`SELECT id, username, theme_id, avatar_id FROM users WHERE username = ?`, [req.params.username], (err, row) => {
    row ? res.json(row) : res.status(404).json({ error: "User not found" });
  });
});

app.post('/send', upload.single('audio'), (req, res) => {
  const { recipientId, type, content, gameMode } = req.body;
  const finalContent = req.file ? req.file.filename : content;

  db.run(`INSERT INTO messages (recipient_id, type, content, game_mode) VALUES (?, ?, ?, ?)`, 
    [recipientId, type || 'text', finalContent, gameMode || 'none'], 
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.get(`SELECT push_token FROM users WHERE id = ?`, [recipientId], (err, row) => {
        if (row && row.push_token) {
           const msgText = type === 'audio' ? "Sent you a voice note 🎤" : "Sent you a secret message 🤫";
           sendPush(row.push_token, msgText);
        }
      });
      res.json({ success: true });
    });
});

app.get('/messages/:userId', (req, res) => {
  db.all(`SELECT * FROM messages WHERE recipient_id = ? ORDER BY id DESC`, [req.params.userId], (err, rows) => {
    res.json(rows);
  });
});

app.post('/update-profile', (req, res) => {
  const { userId, themeId, avatarId } = req.body;
  db.run(`UPDATE users SET theme_id = ?, avatar_id = ? WHERE id = ?`, [themeId, avatarId, userId], (err) => {
    res.json({ success: true });
  });
});

// Backup every Sunday
cron.schedule('0 0 * * 0', async () => {
  try {
      const bot = new TelegramBot(TELEGRAM_TOKEN);
      if (fs.existsSync(DB_PATH)) {
        await bot.sendDocument(TELEGRAM_CHAT_ID, DB_PATH, { caption: "Txtme DB Backup" });
      }
  } catch (e) { console.log("Telegram config missing"); }
});

app.listen(PORT, () => console.log(`Txtme Server running on port ${PORT}`));