// File: server.js  - to submit to insecure branch i had to change name of file to insecure-server.js
// Express server that exposes insecure + secure login/register endpoints
// - Express basics https://www.w3schools.com/nodejs/nodejs_express.asp
// - JS Map https://www.w3schools.com/js/js_maps.asp
// - Date.now https://www.w3schools.com/jsref/jsref_now.asp
// - String.toLowerCase https://www.w3schools.com/jsref/jsref_tolowercase.asp
// - RegExp.test https://www.w3schools.com/jsref/jsref_regexp_test.asp
// - Template literals https://www.w3schools.com/js/js_string_templates.asp

const path = require('path');
const fs = require('fs');
const express = require('express');
const mysql = require('mysql2/promise');
const winston = require('winston');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

/* logging -> logs/app.log */
fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [ new winston.transports.File({ filename: path.join(__dirname, 'logs', 'app.log') }) ]
});
const logInfo = (evt, extra={}) => logger.info({ evt, ...extra });

/* db pool */
const DB_NAME = process.env.DB_NAME || 'secureapp';
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'secureapp',
  password: process.env.DB_PASSWORD || 'change-me',
  database: DB_NAME,
  connectionLimit: 10
});

/* middleware */
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.get('/favicon.ico', (req,res)=>res.status(204).end());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

/* metrics + http logs */
const metrics = { totalRequests:0, loginFailed:0, notesPostedInsecure:0 };
app.use((req,res,next)=>{
  const t0 = Date.now();
  res.on('finish', ()=>{
    if (req.path !== '/favicon.ico') {
      metrics.totalRequests += 1;
      logger.info({
        evt:'http', method:req.method, url:req.originalUrl || req.url,
        status:res.statusCode, duration_ms: Date.now() - t0, ip: req.ip
      });
    }
  });
  next();
});

/* health */
app.get('/health', (req,res)=>res.json({ status:'ok', uptime: process.uptime(), timestamp: Date.now() }));
app.get('/metrics', (req,res)=>res.json(metrics));

/* ensure tables exist (insecure keeps plaintext by design) */
;(async()=>{
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users(
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password_plain VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS notes(
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner VARCHAR(255) NOT NULL,
        heading VARCHAR(255) NOT NULL DEFAULT 'Untitled',
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX(owner)
      )`);
    console.log('DB ready');
  } catch (e) {
    console.error('DB init error:', e.message);
    logger.error({ evt:'db_init_error', message:e.message, code:e.code });
  }
})();

/* landing */
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

/* ---------------- INSECURE auth (vulnerable by design) ---------------- */
app.post('/api/insecure/login', async (req,res)=>{
  const { username, password } = req.body;
  try{
    const [found] = await pool.query("SELECT id,password_plain FROM users WHERE username='"+username+"'");
    if(!found.length){ metrics.loginFailed++; logInfo('auth_fail',{type:'insecure',reason:'user_not_found'}); return res.json({ok:false,message:'User does not exist (INSECURE)'}); }
    const [rows] = await pool.query("SELECT id FROM users WHERE username='"+username+"' AND password_plain='"+password+"'");
    if(!rows.length){ metrics.loginFailed++; logInfo('auth_fail',{type:'insecure',reason:'bad_password'}); return res.json({ok:false,message:'Wrong password (INSECURE)'}); }
    logInfo('auth_ok',{type:'insecure',user:username});
    return res.json({ok:true,message:'Logged in (INSECURE)'});
  }catch(e){
    logger.error({ evt:'db_error_insecure_login', message:e.message, code:e.code });
    return res.status(500).json({ok:false,message:`Error (INSECURE): ${e.message}`});
  }
});

app.post('/api/insecure/register', async (req,res)=>{
  const { username, password, confirm } = req.body;
  if(!username || !password || !confirm) return res.json({ok:false,message:'Missing fields (INSECURE)'});
  if(password!==confirm) return res.json({ok:false,message:'Passwords do not match (INSECURE)'});
  try{
    await pool.query("INSERT INTO users(username,password_plain,password_hash) VALUES ('"+username+"','"+password+"','')");
    logInfo('register_ok',{type:'insecure',user:username});
    return res.json({ok:true,message:'Registered (INSECURE) – PLAINTEXT stored'});
  }catch(e){
    logger.error({ evt:'db_error_insecure_register', message:e.message, code:e.code });
    const msg = e.code==='ER_DUP_ENTRY'?'Username exists (INSECURE)':`DB Error (INSECURE): ${e.message}`;
    return res.status(400).json({ok:false,message:msg});
  }
});

/* ---------------- INSECURE notes api (no auth, raw) ---------------- */
app.get('/api/insecure/notes', async (req,res)=>{
  try{
    const [rows] = await pool.query('SELECT id, owner, heading, content, created_at FROM notes ORDER BY id DESC LIMIT 50');
    res.json({ ok:true, items: rows });
  }catch(e){
    logger.error({ evt:'db_error_insecure_notes_list', message:e.message, code:e.code });
    res.status(500).json({ ok:false, message:'DB error' });
  }
});

app.post('/api/insecure/notes', async (req,res)=>{
  const owner = String(req.body.owner||'anon');
  const heading = String(req.body.heading||'Untitled');
  const content = String(req.body.content||'');
  try{
    await pool.execute('INSERT INTO notes(owner,heading,content) VALUES (?,?,?)',[owner,heading,content]);
    metrics.notesPostedInsecure += 1;
    res.json({ ok:true, message:'Saved' });
  }catch(e){
    logger.error({ evt:'db_error_insecure_notes_insert', message:e.message, code:e.code });
    res.status(500).json({ ok:false, message:'DB error' });
  }
});

/* INSECURE reflected echo (XSS demo) */
app.get('/insecure/echo', (req, res) => {
  const q = req.query.q || '';
  res.send(`
    <h1>Insecure Echo</h1>
    <p>Result for: ${q}</p><!-- intentionally unescaped -->
    <form method="get" action="/insecure/echo">
      <input name="q" placeholder="try: &lt;img src=x onerror=alert('xss')&gt;">
      <button>Echo</button>
    </form>
    <p><a href="/insecure.html">Back</a></p>
  `);
});

/* errors */
app.use((err,req,res,next)=>{
  logger.error({ evt:'error', method:req.method, url:req.url, ip:req.ip, name: err.name, message: err.message });
  res.status(500).send('<h1>Server error</h1><p><a href="/">Home</a></p>');
});

app.listen(PORT, ()=>console.log(`Server running at http://localhost:${PORT}`));
