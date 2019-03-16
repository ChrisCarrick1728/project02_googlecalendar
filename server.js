const express = require('express')
const path = require('path')
const passport = require('passport')
const strategy = require('passport-local').Strategy
const checkLoggedOn = require('connect-ensure-login')
//const expressVue = require("express-vue")
//const compress = require('compression')


// Database connection
const { Pool, Client } = require('pg')
const connectionString = process.env.DATABASE_URL
const pool = new Pool({connectionString: connectionString})

// Setup Express Server
var app = express()

app.use(express.static(path.join(__dirname, 'public')))
app.use(passport.initialize())
app.use(passport.session())

app.set('views', __dirname + '/views')
app.engine('html', require('ejs').renderFile)
app.set('view engine', 'ejs')

//Define Routes
app.get('/', checkLoggedOn.ensureLoggedIn(), (req, res) => {
  res.render('index')  
})

app.get('/login', (req, res) => {
  res.render('index.html')
})

app.get('/logout', (req, res) => {
  req.logout()
  res.redirect('/')
})

app.listen(8000, () => { console.log("server started on port: 8000") })

