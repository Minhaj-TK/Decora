var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var userRouter = require('./routes/user');
var adminRouter = require('./routes/admin');
var exphbs = require('express-handlebars');
var app = express();
var fileUpload = require('express-fileupload')
var db = require('./config/connection')
var session = require('express-session')

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
        add: function(a, b) {
            return a + b;
        },
        formatDate: function(date) {
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
app.use(fileUpload())
app.use(session({secret:"Key",cookie:{maxAge:600000}}))

// Connect to database
db.connect().catch(err => {
    console.error('Unable to connect to database:', err);
    process.exit(1);
});

app.use('/admin', adminRouter);
app.use('/', userRouter);

// Catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// Error handler
app.use(function (err, req, res, next) {
    // Set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // Render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;