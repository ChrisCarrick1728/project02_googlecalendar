var express = require('express');
var passport = require('passport');
var Strategy = require('passport-local').Strategy;
var db = require('./db');
const bcrypt = require('bcrypt')
const PORT = process.env.PORT || 8000
const { google } = require('googleapis')
const compute = google.compute('v1')

// Configure the local strategy for use by Passport.
//
// The local strategy require a `verify` function which receives the credentials
// (`username` and `password`) submitted by the user.  The function must verify
// that the password is correct and then invoke `cb` with a user object, which
// will be set at `req.user` in route handlers after authentication.
passport.use(new Strategy(
  function(username, password, cb) {
    db.users.findByUsername(username, function(err, user) {
      if (err) { return cb(err); }
      if (!user) { return cb(null, false); }
      let pSame = bcrypt.compareSync(password, user.password)
      if (!pSame) { return cb(null, false); }
      return cb(null, user);
    });
  }));


// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  The
// typical implementation of this is as simple as supplying the user ID when
// serializing, and querying the user record by ID from the database when
// deserializing.
passport.serializeUser(function(user, cb) {
  cb(null, user.id);
});

passport.deserializeUser(function(id, cb) {
  db.users.findById(id, function (err, user) {
    if (err) { return cb(err); }
    cb(null, user);
  });
});

// Create a new Express application.
var app = express();

// Configure view engine to render EJS templates.
app.engine('html', require('ejs').renderFile)
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// Use application-level middleware for common functionality, including
// logging, parsing, and session handling.
app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(require('express-session')({ secret: 'thisis@s3c43tk3^', resave: false, saveUninitialized: false }));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());

// Define routes.
app.get('/',
  function(req, res) {
    res.render('index.html', { user: req.user });
  });

app.get('/login',
  function(req, res){
    res.render('login.html');
  });
  
app.post('/login', 
  passport.authenticate('local', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/auth');
  });

app.get('/register', (req, res) => {
  res.render('register.html')
})

app.post('/register', (req, res) => {
  //verify passwords match
  if (req.body.password1 !== req.body.password2) {
    res.redirect('/register')
  } else {
    db.users.addNewUser(req.body, (err, user) => {
      if (err) { res.redirect('/register') }
      res.redirect('/login')
    })
  }
})

app.get('/auth', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  var params = {'name': req.user.username}
  res.render('authPage', params)
})

app.get('/googleConnect', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  db.googleAuth.authorize(db.googleAuth.listEvents, res, req.user.id, (data) => {
    console.log(data);
    res.redirect('/calendar')
  })
})
  
app.get('/googleAuth', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  db.googleAuth.returnOauthCode(req.query.code, req.user.id)
  res.redirect('/calendar')
  res.end();
})

app.get('/calendar', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  var params = {'name': req.user.username}
  res.render('calendar', params)
})


// Services
app.get('/services/listEvents', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
    db.googleAuth.authorize(db.googleAuth.listEvents, res, req.user.id, (data) => {
    res.writeHead('200', {'content-type': 'application/json'})
    res.write(JSON.stringify(data))
    res.end();
  })
})

app.get('/services/listCalendars', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  db.googleAuth.authorize(db.googleAuth.listCalendars, res, req.user.id, (data) => {
  res.writeHead('200', {'content-type': 'application/json'})
  res.write(JSON.stringify(data))
  res.end();
})
})

app.get('/logout',
  function(req, res){
    req.logout();
    res.redirect('/');
  });

app.get('/profile',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res){
    res.render('profile', { user: req.user });
  });

app.listen(PORT, () => {console.log("Server listening on: " + PORT)});
