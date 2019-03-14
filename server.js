var express = require('express')
var path = require('path')
require('dotenv').config()
const connectionString = process.env.DATABASE_URL
const { Pool, Client } = require('pg')
const pool = new Pool({connectionString: connectionString})

express()
  .use(express.static(path.join(__dirname, 'public')))
  .get('/services/test', (req, res) => {
    res.writeHead(200, {"Content-Type": "text/plain"})
    res.write("hello World")
    res.end();
  })
  .listen(8000, () => { console.log("server started on port: 8000")})