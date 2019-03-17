const express = require('express')
const path = require('path')
const passport = require('passport')
const Strategy = require('passport-local').Strategy
const checkLoggedOn = require('connect-ensure-login')
const db = require('./db')
const bcrypt = require('bcrypt')
const saltRounds = 10;
const bodyParser= require('body-parser')
const session = require('express-session')

passport.use(new Strategy(
  function(username, password, cb) {
    console.log('check users: ' + username + ", password: " + password)
    db.users.findByUsername(username, (err, user) =>{
      if (err) { return cb(err); }
      //console.log('user here:')
      //console.log(user)
      if (!user) { 
        //console.log('fail 1')
        //return cb(null, false);
      } else {
        var pSame = true;//bcrypt.compareSync(password, user.password)
        //console.log(pSame)
        if (pSame) {
          //console.log('fail 2')
          return cb(null, user);
        } else {
          //console.log('fail 3')
          return cb(null, false);
        }      
      }
    })
  }
))

passport.serializeUser(function(user, cb) {
  console.log("serializeUser: ")
  console.log(user)
  cb(null, user.id)
})

passport.deserializeUser(function(id, cb) {
  console.log("deserializeUser: " + id)
  db.users.findById(id, function (err, user) {
    if (err) { return cb(err) }
    console.log("deserializeUser: ")
    console.log(user)
    cb(null, user)
  })
})

// Setup Express Server
var app = express()

app.use(express.static(path.join(__dirname, 'public')))
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));
app.use(passport.initialize())
app.use(passport.session())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))
app.use(require('cookie-parser')())
app.use(require('morgan')('combined'));

app.engine('html', require('ejs').renderFile)
app.set('views', __dirname + '/views')
app.set('view engine', 'ejs')

//Define Routes
app.get('/',  (req, res) => { //require('connect-ensure-login').ensureLoggedIn(),
  console.log('home')
  console.log(req.isAuthenticated())
  res.render('index.html')  
})

app.get('/login', (req, res) => {
  res.render('login.html')
})

app.post('/login', passport.authenticate('local', { 
  successRedirect: '/', 
  failureRedirect: '/register',
  successMessage: "success",
  failureMessage: "failure"
 }))

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

app.get('/logout', (req, res) => {
  req.logout()
  res.redirect('/')
})

app.listen(8000, () => { console.log("server started on port: 8000") })

