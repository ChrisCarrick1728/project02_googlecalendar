const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const dotenv = require('dotenv')

//Setup .env
let envFile = 'db.env'
const env = process.env.NODE_ENV || 'db'

if (process.env.ENV !== undefined) {
  envFile = env + ".env"
}

dotenv.config({
  path: "environment/" + envFile
})

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';
const CREDENTIAL = process.env.GOOGLE_CREDENTIALS;
// Load client secrets from a .env file.
// Authorize a client with credentials, then call the Google Calendar API.
//authorize(JSON.parse(CREDENTIAL), listEvents);

// Database connection
const { Pool, Client } = require('pg')
const connectionString = process.env.DATABASE_URL
const pool = new Pool({connectionString: connectionString})

// retrieves the token from the database
// returns a JSON object
function getToken(users_id, cb) {
  process.nextTick(async function() {
    var sql = "SELECT access_token, refresh_token, scope, token_type, expiry_date FROM googleTokens WHERE users_id=" + users_id
    await pool.query(sql, (err, result) => {
      if (err) {
        console.log('getToken() error: ' + err)
        return cb("read from database failed", null)
      }
      //console.log("db results: " + result.rows[0])
      if (result.rowCount != 0 && result.rows[0].access_token != null) {
        //console.log (JSON.stringify(result.rows[0]))
        return cb(null, JSON.stringify(result.rows[0]))
      }
      return cb(true, null)
    })
  });
}

// retrieves the token from the database
// returns a JSON object
function setToken(token, users_id, cb) {
  console.log(token);
  var tokenObject = token
  var access_token = tokenObject.access_token
  var refresh_token = tokenObject.refresh_token
  var scope = tokenObject.scope
  var token_type = tokenObject.token_type
  var expiry_date = tokenObject.expiry_date
  process.nextTick(async function() {
    var sql = "UPDATE googleTokens SET " 
            + "access_token = '" + access_token
            + "', refresh_token = '" + refresh_token
            + "', scope = '" + scope
            + "', token_type = '" + token_type
            + "', expiry_date = '" + expiry_date
            + "' WHERE users_id= '" + users_id + "'"
    console.log(sql)
    await pool.query(sql, (err, result) => {
      if (err) {
        return cb("Save to database failed: " + err)
      }
      return cb(null)
    })
  });
}


/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(callback, res, users_id, cb) {
  console.log("CREDENTIAL: " + CREDENTIAL)
  const {client_secret, client_id, redirect_uris} = JSON.parse(CREDENTIAL).installed;
  redirect_uris[1] = process.env.GOOGLE_REDIRECT_URI
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[1]);
  // Check if we have previously stored a token.
  
  getToken(users_id, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback, res);
    oAuth2Client.setCredentials(JSON.parse(token))
    callback(oAuth2Client, (err, data) => {
      return cb(data)
    })
    
  })

  // fs.readFile(TOKEN_PATH, (err, token) => {
  //   if (err) return getAccessToken(oAuth2Client, callback);
  //   oAuth2Client.setCredentials(JSON.parse(token));
  //   callback(oAuth2Client);
  // });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback, res) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  //res.redirect(authURL);
  //console.log('Authorize this app by visiting this url:', authUrl);
  res.redirect(authUrl);
  // const rl = readline.createInterface({
  //   input: process.stdin,
  //   output: process.stdout,
  // });
  // rl.question('Enter the code from that page here: ', (code) => {
  //   rl.close();
  //   oAuth2Client.getToken(code, (err, token) => {
  //     if (err) return console.error('Error retrieving access token', err);
  //     oAuth2Client.setCredentials(token);
  //     // Store the token to disk for later program executions
  //     setToken(token, 1, (err) => {
  //       if (err) return console.error(err);
  //       console.log("token stored to db");
  //     })
      
  //     // fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
  //     //   if (err) return console.error(err);
  //     //   console.log('Token stored to', TOKEN_PATH);
  //     // });
  //     callback(oAuth2Client);
  //   });
  // });
}

function returnOauthCode(code, users_id) {
  const {client_secret, client_id, redirect_uris} = JSON.parse(CREDENTIAL).installed;
  redirect_uris[1] = process.env.GOOGLE_REDIRECT_URI
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[1]);

  oAuth2Client.getToken(code, (err, token) => {
    if (err) return console.error('Error retrieving access token', err);
    oAuth2Client.setCredentials(token);
    // Store the token to disk for later program executions
    setToken(token, users_id, (err) => {
      if (err) return console.error(err);
      console.log("token stored to db");
    })
    
    // fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
    //   if (err) return console.error(err);
    //   console.log('Token stored to', TOKEN_PATH);
    // });
    //callback(oAuth2Client);
    //console.log(oAuth2Client)
  });
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth, cb) {
  //console.log(auth)
  const calendar = google.calendar({version: 'v3', auth});
  calendar.events.list({
    calendarId: 'primary',
    timeMin: (new Date()).toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) {
      return cb(err, null)
    }
    //console.log(res.data)
    return cb(null, res.data.items)
  })
  //   calendar.events.list({
  //     calendarId: 'primary',
  //     timeMin: (new Date()).toISOString(),
  //     maxResults: 10,
  //     singleEvents: true,
  //     orderBy: 'startTime',
  //   }, (err, res) => {
  //     if (err) return console.log('The API returned an error: ' + err);
  //     const events = res.data.items;
  //     if (events.length) {
  //       console.log('Upcoming 10 events:');
  //       events.map((event, i) => {
  //         const start = event.start.dateTime || event.start.date;
  //         console.log(`${start}: `)
  //         console.log(event.summary);
  //       });
  //     } else {
  //       console.log('No upcoming events found.');
  //     }
  //   });
  // });
}


module.exports = {
  authorize: authorize,
  returnOauthCode: returnOauthCode,
  listEvents: listEvents
}