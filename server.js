require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const accountSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 70 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }
}, { timestamps: true });
const studentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  studentId: { type: String, required: true, trim: true, maxlength: 30 },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, trim: true, lowercase: true, default: '' },
  phone: { type: String, trim: true, default: '', maxlength: 30 },
  course: { type: String, required: true, trim: true, maxlength: 100 },
  year: { type: String, required: true, enum: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Graduate'] },
  status: { type: String, enum: ['Active', 'On leave', 'Graduated'], default: 'Active' },
  dateOfBirth: { type: String, default: '' },
  gender: { type: String, default: '' },
  address: { type: String, default: '', maxlength: 250 },
  guardian: { type: String, default: '', maxlength: 100 },
  notes: { type: String, default: '', maxlength: 1000 }
}, { timestamps: true });
studentSchema.index({ owner: 1, studentId: 1 }, { unique: true });
const Account = mongoose.model('Account', accountSchema);
const Student = mongoose.model('Student', studentSchema);
const safeAccount = account => ({ id: account._id, name: account.name, email: account.email });
const tokenFor = account => jwt.sign({ id: account._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const auth = (req, res, next) => {
  try { req.accountId = jwt.verify((req.headers.authorization || '').replace(/^Bearer\s+/i, ''), process.env.JWT_SECRET).id; next(); }
  catch { res.status(401).json({ message: 'Your session has expired. Please sign in again.' }); }
};

app.get('/api/health', (req, res) => res.json({ database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: 'StudentDesk is open, but MongoDB is not connected yet. Add your Atlas URI to .env and restart the server.' });
  next();
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password || password.length < 8) return res.status(400).json({ message: 'Enter your name, email, and a password of at least 8 characters.' });
    if (await Account.findOne({ email: email.toLowerCase() })) return res.status(409).json({ message: 'An account with that email already exists.' });
    const account = await Account.create({ name: name.trim(), email, password: await bcrypt.hash(password, 12) });
    res.status(201).json({ token: tokenFor(account), user: safeAccount(account) });
  } catch { res.status(500).json({ message: 'Could not create your account.' }); }
});
app.post('/api/auth/login', async (req, res) => {
  const account = await Account.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!account || !await bcrypt.compare(req.body.password || '', account.password)) return res.status(401).json({ message: 'That email and password do not match.' });
  res.json({ token: tokenFor(account), user: safeAccount(account) });
});
app.get('/api/auth/me', auth, async (req, res) => {
  const account = await Account.findById(req.accountId).select('-password');
  if (!account) return res.status(404).json({ message: 'Account not found.' });
  res.json({ user: safeAccount(account) });
});

app.get('/api/students', auth, async (req, res) => {
  const filter = { owner: req.accountId };
  if (req.query.search) filter.$or = ['name', 'studentId', 'course', 'email'].map(key => ({ [key]: { $regex: req.query.search, $options: 'i' } }));
  if (req.query.status && req.query.status !== 'All statuses') filter.status = req.query.status;
  res.json(await Student.find(filter).sort({ createdAt: -1 }));
});
app.get('/api/students/:id', auth, async (req, res) => {
  const student = await Student.findOne({ _id: req.params.id, owner: req.accountId });
  if (!student) return res.status(404).json({ message: 'Student record not found.' });
  res.json(student);
});
app.post('/api/students', auth, async (req, res) => {
  try {
    const student = await Student.create({ ...req.body, owner: req.accountId });
    res.status(201).json(student);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'That student ID is already in use in your records.' });
    if (error.name === 'ValidationError') return res.status(400).json({ message: Object.values(error.errors)[0].message });
    res.status(500).json({ message: 'Could not save this student record.' });
  }
});
app.patch('/api/students/:id', auth, async (req, res) => {
  try {
    const fields = ['studentId', 'name', 'email', 'phone', 'course', 'year', 'status', 'dateOfBirth', 'gender', 'address', 'guardian', 'notes'];
    const updates = Object.fromEntries(fields.filter(field => Object.hasOwn(req.body, field)).map(field => [field, req.body[field]]));
    const student = await Student.findOneAndUpdate({ _id: req.params.id, owner: req.accountId }, updates, { new: true, runValidators: true, context: 'query' });
    if (!student) return res.status(404).json({ message: 'Student record not found.' });
    res.json(student);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'That student ID is already in use in your records.' });
    if (error.name === 'ValidationError') return res.status(400).json({ message: Object.values(error.errors)[0].message });
    res.status(500).json({ message: 'Could not update this student record.' });
  }
});
app.delete('/api/students/:id', auth, async (req, res) => {
  const student = await Student.findOneAndDelete({ _id: req.params.id, owner: req.accountId });
  if (!student) return res.status(404).json({ message: 'Student record not found.' });
  res.json({ message: 'Student record deleted.' });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
const port = process.env.PORT || 3000;
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/studentdesk')
  .then(() => console.log('MongoDB connected.'))
  .catch(error => console.error('MongoDB connection failed:', error.message));
app.listen(port, () => console.log(`StudentDesk is running at http://localhost:${port}`));
