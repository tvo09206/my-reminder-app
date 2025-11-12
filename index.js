require('dotenv').config();// 1. 导入所有工具
const express = require('express');
const multer = require('multer');
const path = require('path');
const { Pool } = require('pg'); // 💡 新增：导入 'pg' (PostgreSQL 驱动)

// 2. 初始化 Express 和 端口
const app = express();
const port = 3000;

// 3. 告诉 Express 帮我们读 JSON
app.use(express.json());

// 4. 让 'uploads' 文件夹可被网络访问 (不变)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 💡 --- 真实项目修改：连接到 Supabase 云数据库 --- 💡

// 💡 --- 真实项目修改：连接到 Supabase 云数据库 (最终修复版) --- 💡

// ⬇️⬇️⬇️ **从“环境变量”中读取信息** ⬇️⬇️⬇️
const DB_HOST = "db.bdxipwejyrstcndbespt.supabase.co"; 
const DB_PASSWORD = process.env.DATABASE_PASSWORD; // ⬅️ 自动从 .env 文件读取
// ⬆️⬆️⬆️ **安全了！** ⬆️⬆️⬆️

// 创建数据库连接池 (专业版)
// 这样配置，你的密码里有任何特殊字符 (#, ?, /) 都不会出错
const pool = new Pool({
  user: 'postgres',     // 默认用户名
  host: DB_HOST,        // 你的数据库主机地址
  database: 'postgres', // 默认数据库
  password: DB_PASSWORD,// 你的密码
  port: 5432, 
  family: 4,// 默认端口
  connectionTimeoutMillis: 30000,
});

// 启动时，创建我们需要的“提醒表”
pool.query(`
  CREATE TABLE IF NOT EXISTS reminders (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    voice_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => {
  console.log('成功连接到云数据库，并确保 "reminders" 表存在。');
}).catch(err => {
  console.error('数据库初始化失败:', err);
});

// 💡 --- Multer 配置 (不变) --- 💡
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// -----------------------------------------------------
// 💡 真实项目 API 1：创建带语音的提醒 (云数据库版) 💡
// -----------------------------------------------------
app.post('/create-reminder', upload.single('voice_file'), async (req, res) => {
  const { title } = req.body;
  if (!req.file) {
    return res.status(400).json({ error: '必须上传语音文件！' });
  }

  // 构造文件的可访问 URL (请确保把 localhost 换成你服务器的公网 IP)
  const voiceUrl = `http://localhost:${port}/uploads/${req.file.filename}`;
  console.log('正在创建新提醒:', title, voiceUrl);

  const sql = `INSERT INTO reminders (title, voice_url) VALUES ($1, $2) RETURNING *`;
  
  try {
    const result = await pool.query(sql, [title, voiceUrl]);
    res.json({
      message: '提醒创建成功！',
      data: result.rows[0] // 返回插入的新数据
    });
  } catch (err) {
    console.error('数据库插入失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// -----------------------------------------------------
// 💡 真实项目 API 2：获取所有提醒 (云数据库版) 💡
// -----------------------------------------------------
app.get('/reminders', async (req, res) => {
  console.log('有人来获取所有提醒列表了！');
  const sql = `SELECT * FROM reminders ORDER BY created_at DESC`;
  
  try {
    const result = await pool.query(sql);
    res.json(result.rows); // 返回所有查询到的数据
  } catch (err) {
    console.error('数据库查询失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 6. 启动服务器
app.listen(port, () => {
  console.log(`服务器已启动，正在监听 http://localhost:${port}`);
});
