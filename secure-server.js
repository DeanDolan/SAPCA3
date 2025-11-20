// File: server.js  (SECURE BRANCH ONLY)
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
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
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
const logWarn = (evt, extra={}) => logger.warn({ evt, ...extra });

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
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));
app.get('/favicon.ico', (req,res)=>res.status(204).end());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

/* metrics + http logs */
const metrics = { totalRequests:0, loginFailed:0, lockedOut:0, notesPostedSecure:0 };
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

/* helpers */
const attempts = new Map();
const WINDOW_MS = 15*60*1000, MAX_FAILS = 5, LOCK_MS = 15*60*1000;
const k = (u,ip)=>`${String(u||'').toLowerCase()}|${ip}`;
const now = ()=>Date.now();
const left = ms => { const s=Math.ceil(ms/1000), m=Math.floor(s/60); return `${m}m ${s%60}s`; };
function checkLocked(user, ip){
  const r = attempts.get(k(user,ip));
  if(!r) return {locked:false};
  if(r.lockUntil && r.lockUntil>now()) return {locked:true, msg:`Too many attempts Try again in ${left(r.lockUntil-now())}`};
  if(r.first && now()-r.first>WINDOW_MS) attempts.delete(k(user,ip));
  return {locked:false};
}
function registerFailure(user, ip){
  const kk = k(user,ip);
  const r = attempts.get(kk) || {count:0, first:now(), lockUntil:0};
  if(now()-r.first>WINDOW_MS){ r.count=0; r.first=now(); r.lockUntil=0; }
  r.count += 1;
  if(r.count>=MAX_FAILS){ r.lockUntil = now()+LOCK_MS; metrics.lockedOut = (metrics.lockedOut||0)+1; logWarn('lockout',{ user, ip }); }
  attempts.set(kk, r);
}
function clearAttempts(user, ip){ attempts.delete(k(user,ip)); }
function requireAuth(req,res,next){ if(!req.session?.username) return res.status(401).json({ ok:false, message:'Login required' }); next(); }
function htmlEscape(s=''){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

/* ensure tables exist + auto-migrate heading */
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
        heading VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX(owner)
      )`);

    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS cnt
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'notes' AND COLUMN_NAME = 'heading'`,
      [DB_NAME]
    );
    if (rows[0].cnt === 0) {
      await pool.execute(`ALTER TABLE notes ADD COLUMN heading VARCHAR(255) NOT NULL DEFAULT 'Untitled' AFTER owner`);
      logger.info({ evt:'migrate', message:'Added heading column to notes' });
    }
    console.log('DB ready');
  } catch (e) {
    console.error('DB init/migrate error:', e.message);
    logger.error({ evt:'db_init_error', message:e.message, code:e.code });
  }
})();

/* landing */
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

/* ---------------- SECURE auth ---------------- */
const secureLoginLimiter = rateLimit({
  windowMs: 60*1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok:false, message:'Too many attempts from this IP Please try again shortly' }
});

app.post('/api/secure/login', secureLoginLimiter, async (req,res)=>{
  const { username, password } = req.body;
  const ip = req.ip;
  const GENERIC='Invalid username or password';
  const st = checkLocked(username, ip);
  if(st.locked) return res.json({ok:false,message:st.msg});
  try{
    const [rows] = await pool.execute('SELECT id,password_hash FROM users WHERE username=?',[username]);
    if(!rows.length){ (metrics.loginFailed = (metrics.loginFailed||0)+1); registerFailure(username,ip); logInfo('auth_fail',{type:'secure',reason:'user_not_found',ip}); return res.json({ok:false,message:GENERIC}); }
    const ok = await bcrypt.compare(String(password||''), rows[0].password_hash);
    if(!ok){ (metrics.loginFailed = (metrics.loginFailed||0)+1); registerFailure(username,ip); logInfo('auth_fail',{type:'secure',reason:'bad_password',ip}); return res.json({ok:false,message:GENERIC}); }
    clearAttempts(username, ip);
    req.session.username = username;
    logInfo('auth_ok',{type:'secure',user:username,ip});
    return res.json({ok:true,message:'Logged in (SECURE)'});
  }catch(e){
    logger.error({ evt:'db_error_secure_login', message:e.message, code:e.code });
    return res.status(500).json({ok:false,message:'Try again later'});
  }
});

app.post('/api/secure/register', async (req,res)=>{
  const { username, password, confirm } = req.body;
  if(!username || !password || !confirm) return res.json({ok:false,message:'Missing fields'});
  if(password!==confirm) return res.json({ok:false,message:'Passwords do not match'});
  const p = String(password||'').trim();
  if(p.length<12 || !/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p) || !/[^A-Za-z0-9]/.test(p) || p.toLowerCase().includes(String(username).toLowerCase()))
    return res.json({ok:false,message:'Weak password policy not met'});
  try{
    const hash = await bcrypt.hash(p,12);
    await pool.execute('INSERT INTO users(username,password_plain,password_hash) VALUES (?,?,?)',[username,'',hash]);
    logInfo('register_ok',{type:'secure',user:username});
    return res.json({ok:true,message:'Registration successful'});
  }catch(e){
    logger.error({ evt:'db_error_secure_register', message:e.message, code:e.code });
    if(e.code==='ER_DUP_ENTRY') return res.json({ok:false,message:'Username already taken'});
    return res.status(500).json({ok:false,message:'Server error'});
  }
});

/* ---------------- SECURE notes (CRUD) ---------------- */
app.get('/api/secure/notes', requireAuth, async (req,res)=>{
  try{
    const [rows] = await pool.execute(
      'SELECT id, heading, content, created_at FROM notes WHERE owner = ? ORDER BY id DESC LIMIT 50',
      [req.session.username]
    );
    res.json({ ok:true, items: rows });
  }catch(e){
    logger.error({ evt:'db_error_secure_notes_list', message:e.message, code:e.code });
    res.status(500).json({ ok:false, message:'DB error' });
  }
});

app.post('/api/secure/notes', requireAuth, async (req,res)=>{
  const heading = String(req.body.heading||'').trim();
  const content = String(req.body.content||'').trim();
  if(!heading || heading.length>255) return res.status(400).json({ok:false,message:'Invalid heading'});
  if(!content || content.length>1000) return res.status(400).json({ok:false,message:'Invalid content'});
  try{
    await pool.execute('INSERT INTO notes(owner,heading,content) VALUES (?,?,?)',[req.session.username,heading,content]);
    metrics.notesPostedSecure += 1;
    const [rows] = await pool.execute(
      'SELECT id, heading, content, created_at FROM notes WHERE owner = ? ORDER BY id DESC LIMIT 10',
      [req.session.username]
    );
    res.json({ ok:true, message:'Saved', items: rows });
  }catch(e){
    logger.error({ evt:'db_error_secure_notes_insert', message:e.message, code:e.code });
    res.status(500).json({ ok:false, message:'DB error' });
  }
});

app.put('/api/secure/notes/:id', requireAuth, async (req,res)=>{
  const id = Number(req.params.id);
  const heading = String(req.body.heading||'').trim();
  const content = String(req.body.content||'').trim();
  if(!Number.isInteger(id) || id<=0) return res.status(400).json({ ok:false, message:'Invalid id' });
  if(!heading || heading.length>255) return res.status(400).json({ok:false,message:'Invalid heading'});
  if(!content || content.length>1000) return res.status(400).json({ok:false,message:'Invalid content'});
  try{
    const [r] = await pool.execute(
      'UPDATE notes SET heading=?, content=? WHERE id=? AND owner=?',
      [heading, content, id, req.session.username]
    );
    if (r.affectedRows === 0) return res.status(404).json({ ok:false, message:'Not found' });
    const [rows] = await pool.execute(
      'SELECT id, heading, content, created_at FROM notes WHERE owner = ? ORDER BY id DESC LIMIT 50',
      [req.session.username]
    );
    logInfo('note_edit',{ user:req.session.username, id });
    res.json({ ok:true, message:'Updated', items: rows });
  }catch(e){
    logger.error({ evt:'db_error_secure_notes_update', message:e.message, code:e.code });
    res.status(500).json({ ok:false, message:'DB error' });
  }
});

app.delete('/api/secure/notes/:id', requireAuth, async (req,res)=>{
  const id = Number(req.params.id);
  if(!Number.isInteger(id) || id<=0) return res.status(400).json({ ok:false, message:'Invalid id' });
  try{
    const [r] = await pool.execute(
      'DELETE FROM notes WHERE id=? AND owner=?',
      [id, req.session.username]
    );
    if (r.affectedRows === 0) return res.status(404).json({ ok:false, message:'Not found' });
    const [rows] = await pool.execute(
      'SELECT id, heading, content, created_at FROM notes WHERE owner = ? ORDER BY id DESC LIMIT 50',
      [req.session.username]
    );
    logInfo('note_delete',{ user:req.session.username, id });
    res.json({ ok:true, message:'Deleted', items: rows });
  }catch(e){
    logger.error({ evt:'db_error_secure_notes_delete', message:e.message, code:e.code });
    res.status(500).json({ ok:false, message:'DB error' });
  }
});

/* SECURE reflected echo encoded */
app.get('/secure/echo', (req, res) => {
  const q = req.query.q || '';
  res.send(`
    <h1>Secure Echo</h1>
    <p>Result for: ${htmlEscape(q)}</p>
    <form method="get" action="/secure/echo">
      <input name="q" placeholder="input will be encoded">
      <button>Echo</button>
    </form>
    <p><a href="/secure.html">Back</a></p>
  `);
});

/* logout */
app.get('/secure/logout', (req,res)=>{ req.session.destroy(()=>res.redirect('/secure.html')) });

/* errors */
app.use((err,req,res,next)=>{
  logger.error({ evt:'error', method:req.method, url:req.url, ip:req.ip, name: err.name, message: err.message });
  res.status(500).send('<h1>Server error</h1><p><a href="/">Home</a></p>');
});

app.listen(PORT, ()=>console.log(`Server running at http://localhost:${PORT}`));
