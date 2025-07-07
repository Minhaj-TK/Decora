var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var userRouter = require('./routes/user');
var adminRouter = require('./routes/admin');
var exphbs = require('express-handlebars');
var app = express();
var fileUpload = require('express-fileupload');
var db = require('./config/connection');
var session = require('express-session');
const MongoStore = require('connect-mongo');

// Configure express-handlebars
var hbs = exphbs.create({
    extname: '.hbs',
    defaultLayout: 'layout',
    layoutsDir: __dirname + '/views/layout/',
    partialsDir: __dirname + '/views/partials/',
    helpers: {
        eq: function (v1, v2) {
            return v1 === v2;
        },
        gt: function (a, b) {
            return a > b;
        },
        multiply: function (a, b) {
            return a * b;
        },
        sum: function (products) {
            return products.reduce((total, item) => total + (item.quantity * item.product.price), 0);
        },
        add: function (a, b) {
            return a + b;
        },
        formatDate: function (date) {
            return new Date(date).toLocaleDateString();
        }
    }
});

// View engine setup
app.engine('hbs', hbs.engine);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileUpload());

// Connect to MongoDB before using routes
db.connect().then(() => {
    console.log('✅ MongoDB connected');

    // Use connect-mongo as session store
    app.use(session({
        secret: "Key",
        resave: false,
        saveUninitialized: true,
        cookie: { maxAge: 600000 },
        store: MongoStore.create({
            mongoUrl: 'mongodb+srv://decora:Decora%40123@cluster0.g3iosmw.mongodb.net/?retryWrites=true&w=majority&tls=true', // 🔁 Replace with your actual MongoDB connection string
            dbName: 'shopping'        // 🔁 Replace with your actual DB name
        })
    }));

    // Define routes
    app.use('/admin', adminRouter);
    app.use('/', userRouter);

    // Catch 404 and forward to error handler
    app.use(function (req, res, next) {
        next(createError(404));
    });

    // Error handler
    app.use(function (err, req, res, next) {
        res.locals.message = err.message;
        res.locals.error = req.app.get('env') === 'development' ? err : {};
        res.status(err.status || 500);
        res.render('error');
    });

}).catch(err => {
    console.error('❌ Unable to connect to MongoDB:', err);
    process.exit(1);
});

module.exports = app;
