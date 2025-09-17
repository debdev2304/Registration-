'use strict';

const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { db } = require('./db');

const participantRoutes = require('./routes/participant');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(helmet());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

const sessionSecret = process.env.SESSION_SECRET || 'dev_secret';
app.use(
	session({
		secret: sessionSecret,
		resave: false,
		saveUninitialized: false,
		cookie: { httpOnly: true }
	})
);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
	res.redirect('/participant/login');
});

app.use('/participant', participantRoutes);
app.use('/admin', adminRoutes);

app.use((err, req, res, next) => {
	console.error(err);
	res.status(500).send('Internal Server Error');
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
	console.log(`Server listening on http://localhost:${port}`);
});
