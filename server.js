var express = require('express');
var passport = require('passport');
var Strategy = require('passport-local').Strategy;
var db = require('./db');
const bcrypt = require('bcrypt')
const PORT = process.env.PORT || 8000
const { google } = require('googleapis')
const compute = google.compute('v1')
const bodyParser = require('body-parser')
const urlencodedParser = bodyParser.urlencoded({extended: false})
const calendar = require('node-calendar')

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

function getDateFromPath(path) {
  var p = path.split('/');
  console.log(p)
  return p[p.length - 1]
}

function monthName(month) {
  switch(parseInt(month)) {
    case 01: return "Jan"
    case 02: return "Feb"
    case 03: return "Mar"
    case 04: return "Apr"
    case 05: return "May"
    case 06: return "Jun"
    case 07: return "Jul"
    case 08: return "Aug"
    case 09: return "Sep"
    case 10: return "Oct"
    case 11: return "Nov"
    case 12: return "Dec"
    default: return "err"
  }
}

function getFirstDayOfWeek(date) {
  var d = date.split('-')
  var day = calendar.weekday(d[2], d[0], d[1])
  var cal = new calendar.Calendar(6).monthdatescalendar(d[2], d[0])
  var nDate = (d[2] + '-' + d[0] + '-' + d[1])
  //console.log('week: ' + parseInt((d[1] + day) % 7))
  //console.log('nDate: ' + nDate)
  for (var i = 0; i < cal.length; i++) {
    for (var w = 0; w < cal[i].length; w++) {
      var dText = cal[i][w]
      var tempDate = dText.toString().split(' ')
      //console.log("dText: "+ monthName(d[0]) + " - " + tempDate[1] + " | " + d[1] + " - " + tempDate[2])
      
      if (tempDate[2] === d[1] && tempDate[1] === monthName(d[0])) {
        return cal[i]
      }
    }
  }
}

function formatDate(date) {
  var d = date.split('-')

  var nDate = new Date(d[2], d[0] - 1, d[1])
  nDate.setHours(00)
  return nDate 
}

// Create a new Express application.
var app = express();

app.use(express.static(__dirname + '/public'))

// Configure view engine to render EJS templates.
app.engine('html', require('ejs').renderFile)
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// Use application-level middleware for common functionality, including
// logging, parsing, and session handling.
app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(require('express-session')({ secret: 'thisis@s3c43tk3^', resave: false, saveUninitialized: false }));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());

// Define routes.
app.get('/',
  function(req, res) {
    res.redirect('/login')
  });

app.get('/login',
  function(req, res){
    res.render('login');
  });
  
app.post('/login', 
  passport.authenticate('local', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/calendar/month/');
  });

app.get('/register', (req, res) => {
  res.render('register.html')
})

app.post('/register', (req, res) => {
  //verify passwords match
  console.log(req.body)
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
  db.googleAuth.authorize(db.googleAuth.listEvents, null, res, req.user.id, (err, data) => {
    //console.log(data);
    res.redirect('/calendar/month/')
  })
})
  
app.get('/googleAuth', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  db.googleAuth.returnOauthCode(req.query.code, req.user.id)
  res.redirect('/calendar/month/')
  res.end();
})

// Month View
app.get('/calendar/month/*', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  var date = getDateFromPath(req.path)
  if (typeof(date === 'undefined')) {
    d = new Date();
    date = d.getMonth() + '-' + d.getFullYear()
  }
  var params = {'name': req.user.username, 'date': date, 'view': 'month'}
  res.render('calendar', params)
})

// Week View
app.get('/calendar/week/*', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  var params = {'name': req.user.username, 'date': getDateFromPath(req.path), 'view': 'week'}
  res.render('calendar', params)
})

// Day View
app.get('/calendar/day/*', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  var params = {'name': req.user.username, 'date': getDateFromPath(req.path), 'view': 'day'}
  res.render('calendar', params)
})

//Insert Event
app.get('/insert', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  var params = {'name': req.user.username, 'date': getDateFromPath(req.path), 'view': 'day'}
  res.render('insert', params)
})


// Services
app.post('/services/listEvents', (req, res) => {
  console.log("post: ")
  console.log(req.body)

  var sdate = ''
  var edate = ''

  if (req.body.view === 'week') {
    sdate = new Date(getFirstDayOfWeek(req.body.start)[0])
    edate = new Date(getFirstDayOfWeek(req.body.start)[6])
    var params = {
      timeMax: edate.toISOString(),
      timeMin: sdate.toISOString()
    }
  } else if (req.body.view === 'day') {
    sdate = (formatDate(req.body.start))
    edate = (formatDate(req.body.start))
    edate.setHours(24)
    console.log(sdate + " | " + edate)
    var params = {
      timeMax: edate.toISOString(),
      timeMin: sdate.toISOString()
    }
  } else if (req.body.view === 'month') {
    console.log(req.body.start + " | " + req.body.end)
    sdate = new Date(req.body.start)
    edate = new Date(req.body.end)
    console.log(sdate + " | " + edate)
    var params = {
      timeMax: edate.toISOString(),
      timeMin: sdate.toISOString()
    }
  }
  db.googleAuth.authorize(db.googleAuth.listEventsWeek, params, res, req.user.id, (err, data) => {
    res.writeHead('200', {'content-type': 'application/json'})
    //console.log(data)
    res.write(JSON.stringify(data))
    res.end();
  })
})

app.post('/services/insert', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  console.log(req.body.event)
  db.googleAuth.authorize(db.googleAuth.insertEvent, req.body, res, req.user.id, (err, data) => {
    if (!err) {
      res.writeHead('200', {'content-type': 'application/json'})
      res.write(JSON.stringify(data))
      res.end();
    } else {
      res.writeHead('500', {'content-type': 'application/json'})
      res.write("{'success': 'false', 'error': '" + err + "'}")
      res.end();
    }
  })
})

app.delete('/services/deleteEvent/*', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  var params = {
    'id': req.path.split('/')[3]
  }
  db.googleAuth.authorize(db.googleAuth.deleteEvent, params, res, req.user.id, (err, data) => {
    if (!err) {
      res.writeHead('200', {'content-type': 'application/json'})
      res.write(JSON.stringify(data))
      res.end();
    } else {
      res.writeHead('500', {'content-type': 'application/json'})
      res.write("{'success': 'false', 'error': '" + err + "'}")
      res.end();
    }
  })
})

app.get('/services/updateEvent', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  db.googleAuth.authorize(db.googleAuth.updateEvent, req.body, res, req.user.id, (err, data) => {
    res.writeHead('200', {'content-type': 'application/json'})
    res.write(JSON.stringify(data))
    res.end();
  })
})

app.get('/services/getMonthView', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  var cDate = new Date() //req.query.date)
  console.log(req.query)
  cDate.setFullYear(req.query.year, req.query.month - 1, 1)
  console.log(cDate)
  var c = new calendar.Calendar(6).monthdatescalendar(cDate.getFullYear(), cDate.getMonth() + 1)
  var data = {
    'ISOString': cDate.toISOString(),
    'currentYear': cDate.getFullYear(),
    'currentMonth': cDate.getMonth() + 1,
    'currentDay': cDate.getDay(),
    'startDay' : c[0][0],
    'endDay' : c[c.length - 1][c[c.length - 1].length - 1],
    'month': {}
  }
  //Build Response
  for (var weeks = 0; weeks < c.length; weeks++) {
    var week = {}
    for (var days = 0 ; days < c[weeks].length; days++) {
      var dateTime = c[weeks][days].toISOString().split('T')
      var date = dateTime[0].split('-')
      var day = date[2]
      var month = date[1]
      var year = date [0]
      //console.log( month + " | " + parseInt(cDate.getMonth() + 1) )
      var inCurrentMonth = ((month == cDate.getMonth() + 1) ? 'true' : 'false')
      //console.log(inCurrentMonth)
      week[days] = {
        'ISOString': c[weeks][days].toISOString(),
        'date': c[weeks][days].toISOString().split('T')[0],
        'year': year,
        'month': month,
        'day': day,
        'inCurrentMonth': inCurrentMonth
      }
    }
    data.month[weeks] = week;
  }
  res.writeHead('200', {'content-type': 'application/json'})
  res.write(JSON.stringify(data))
  res.end();
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
