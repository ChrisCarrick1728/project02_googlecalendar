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
  for (var i = 0; i < cal.length; i++) {
    for (var w = 0; w < cal[i].length; w++) {
      var dText = cal[i][w]
      var tempDate = dText.toString().split(' ')
      
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
  if (date == '') {
    d = new Date();
    date = parseInt(d.getMonth() + 1) + '-' + d.getDate() + '-' + d.getFullYear()
    res.redirect('/calendar/month/' + date);
    res.end();
  } else {
    var t = new Date()
    var today = {
      'day': t.getDate(),
      'month': t.getMonth(),
      'year' : t.getFullYear()
    } 
    var params = {'name': req.user.username, 'date': date, 'view': 'month', 'today': today }
    res.render('calendar', params)
  }
})

// Week View
app.get('/calendar/week/*', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  var date = getDateFromPath(req.path)
  if (date == '') {
    d = new Date();
    date = parseInt(d.getMonth() + 1) + '-' + d.getDate() + '-' + d.getFullYear()
    res.redirect('/calendar/week/' + date);
    res.end();
  } else {
    var t = new Date()
    var today = {
      'day': t.getDate(),
      'month': t.getMonth(),
      'year' : t.getFullYear()
    } 
    var params = {'name': req.user.username, 'date': date, 'view': 'month', 'today': today }
    res.render('calendarWeek', params)
  }
})

// Day View
app.get('/calendar/day/*', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  var date = getDateFromPath(req.path)
  if (date == '') {
    d = new Date();
    date = parseInt(d.getMonth() + 1) + '-' + d.getDate() + '-' + d.getFullYear()
    res.redirect('/calendar/day/' + date);
    res.end();
  } else {
    var t = new Date()
    var today = {
      'day': t.getDate(),
      'month': t.getMonth(),
      'year' : t.getFullYear()
    } 
    var params = {'name': req.user.username, 'date': date, 'view': 'month', 'today': today }
    res.render('calendarDay', params)
  }
})

//Insert Event
app.get('/insert', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  var params = {'name': req.user.username, 'date': getDateFromPath(req.path), 'view': 'day'}
  res.render('insert', params)
})


// Services
app.post('/services/listEvents', (req, res) => {
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
    var params = {
      timeMax: edate.toISOString(),
      timeMin: sdate.toISOString()
    }
  } else if (req.body.view === 'month') {
    sdate = new Date(req.body.start)
    edate = new Date(req.body.end)
    var params = {
      timeMax: edate.toISOString(),
      timeMin: sdate.toISOString()
    }
  }
  db.googleAuth.authorize(db.googleAuth.listEventsWeek, params, res, req.user.id, (err, data) => {
    res.writeHead('200', {'content-type': 'application/json'})
    res.write(JSON.stringify(data))
    res.end();
  })
})

app.post('/services/insert', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
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

app.post('/services/updateEvent', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  var params = req.body
  db.googleAuth.authorize(db.googleAuth.updateEvent, params, res, req.user.id, (err, data) => {
    if (err) {
      res.writeHead('400', {'content-type': 'application/json'})
      res.write("{'success': 'false', 'error': '" + err + "'}")
      res.end();
    } else {
      res.writeHead('200', {'content-type': 'application/json'})
      res.write(JSON.stringify(data))
      res.end();
    }
  })
})

app.get('/services/getMonthView', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  var cDate = new Date() 
  cDate.setFullYear(req.query.year, req.query.month - 1)
  var c = new calendar.Calendar(6).monthdatescalendar(cDate.getFullYear(), cDate.getMonth() + 1)
  var numDaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30 ,31, 29]
  var leapYear = calendar.isleap(cDate.getFullYear())
  var lastDayInView = c[c.length -1][c[c.length - 1].length - 1]
  lastDayInView = lastDayInView.toISOString().split('T')[0].split('-')[2]
  var data = {
    'ISOString': cDate.toISOString(),
    'currentYear': cDate.getFullYear(),
    'currentMonth': cDate.getMonth() + 1,
    'currentDay': cDate.getDate(),
    'startDay' : c[0][0],
    'numDaysInMonth': numDaysInMonth[((leapYear && cDate.getMonth == 1) ? 12 : cDate.getMonth())],
    'lastDayInView': parseInt(lastDayInView),
    'firstDayInView': c[0][0].toISOString().split('T')[0].split('-')[2],
    'leapYear': leapYear,
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
      var inCurrentMonth = ((month == cDate.getMonth() + 1) ? 'true' : 'false')
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

app.get('/services/getWeekView', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  var cDate = new Date() 
  cDate.setFullYear(req.query.year, req.query.month - 1, req.query.day - 1)
  cDate.setUTCHours(6,0,0,0)
  var c = new calendar.Calendar(6).monthdatescalendar(cDate.getFullYear(), cDate.getMonth() + 1)
  var firstDayOfWeek = 0;
  var lastDayOfWeek = 0;
  var weekObj = 0;
  for (var week = 0; week < c.length; week++) {
    for (var day = 0; day < 7; day++) {
      if (c[week][day].getMonth() == cDate.getMonth()) {
        if (c[week][day].getDate() == cDate.getDate()) {
          firstDayOfWeek = c[week][0]
          lastDayOfWeek = c[week][6]
          weekObj = c[week]
        }
      }
    }
  }
  var numDaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30 ,31, 29]
  var leapYear = calendar.isleap(cDate.getFullYear())
  var lastDayInView = c[c.length -1][c[c.length - 1].length - 1]
  lastDayInView = lastDayInView.toISOString().split('T')[0].split('-')[2]
  var data = {
    'ISOString': cDate.toISOString(),
    'currentYear': cDate.getFullYear(),
    'currentMonth': cDate.getMonth() + 1,
    'currentDay': cDate.getDate(),
    'firstDayOfWeek': firstDayOfWeek,
    'lastDayOfWeek': lastDayOfWeek,
    'numDaysInMonth': numDaysInMonth[((leapYear && cDate.getMonth == 1) ? 12 : cDate.getMonth())],
    'lastDayInView': parseInt(lastDayInView),
    'leapYear': leapYear,
    'date': cDate.toISOString().split('T')[0],
    'week': {}
  }
  var week = {}
  for (var i = 0; i < weekObj.length; i++) {
    var ISOString = weekObj[i].toISOString()
    var date1 = ISOString.split('T')[0]
    var date = date1.split('-')
    var day = date[2]
    var month = date[1]
    var year = date[0]
    var currentDay = (cDate.getDate() == day? true : false)
    week[i] = {
      'ISOString': ISOString,
      'date': date1,
      'day': day,
      'year': year,
      'month': month,
      'currentDay': currentDay
    }
  }
  data.week = week
  //Build Response
  
  res.writeHead('200', {'content-type': 'application/json'})
  res.write(JSON.stringify(data))
  res.end();
})

app.get('/services/getDayView', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  var cDate = new Date() 
  cDate.setFullYear(req.query.year, req.query.month - 1, req.query.day)
  var c = new calendar.Calendar(6).monthdatescalendar(cDate.getFullYear(), cDate.getMonth() + 1)
  var numDaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30 ,31, 29]
  var leapYear = calendar.isleap(cDate.getFullYear())
  var lastDayInView = c[c.length -1][c[c.length - 1].length - 1]
  lastDayInView = lastDayInView.toISOString().split('T')[0].split('-')[2]
  var data = {
    'ISOString': cDate.toISOString(),
    'currentYear': cDate.getFullYear(),
    'currentMonth': cDate.getMonth() + 1,
    'currentDay': cDate.getDate(),
    'numDaysInMonth': numDaysInMonth[((leapYear && cDate.getMonth == 1) ? 12 : cDate.getMonth())],
    'lastDayInView': parseInt(lastDayInView),
    'leapYear': leapYear,
    'date': cDate.toISOString().split('T')[0],
    'month': {}
  }
  //Build Response
  
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
