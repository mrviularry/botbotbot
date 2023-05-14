const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

let clientConfigs = {};
let userApiKeys = {};

app.get('/admin', (req, res) => {
  res.send(`
    <html>
      <head>
        <style>
          body { background-color: purple; color: white; }
          form { margin: 50px; }
          input { margin-top: 20px; }
        </style>
      </head>
      <body>
        <form action="/admin" method="post">
          <label for="clientId">Client ID:</label><br>
          <input type="text" id="clientId" name="clientId"><br>
          <input type="submit" value="Generate API Key">
        </form>
      </body>
    </html>
  `);
});

app.post('/admin', (req, res) => {
  const clientId = req.body.clientId;

  // Generate a new API key for this client
  const apiKey = crypto.randomBytes(20).toString('hex');
  userApiKeys[clientId] = apiKey;

  // Return the API key to the client
  res.send('Your new API key is: ' + apiKey);
});

app.post('/config', (req, res) => {
  const { clientId, config, apiKey } = req.body;

  if (apiKey !== userApiKeys[clientId]) {
    return res.status(403).send('Invalid API key');
  }

  clientConfigs[clientId] = config;

  res.sendStatus(200);
});

app.use(async (req, res, next) => {
  const clientId = req.headers['X-Client-ID'];
  const apiKey = req.headers['X-Api-Key'];

  if (!clientConfigs[clientId] || !userApiKeys[clientId] || userApiKeys[clientId] !== apiKey) {
    return res.status(403).send('Access denied');
  }

  const config = clientConfigs[clientId];

  const ip = req.ip;
  const response = await axios.get(`https://ipinfo.io/${ip}?token=YOUR_IPINFO_TOKEN`);

  const { country, vpn, datacenter } = response.data;

  if (!config.allowedCountries.includes(country)) {
    return res.status(403).send('Access denied');
  }

  if ((config.blockVpn && vpn) || (config.blockDatacenter && datacenter)) {
    return res.status(403).send('Access denied');
  }

  // If the client has specified a redirect URL and the request is a GET, redirect to it
  if (config.redirectUrl && req.method === 'GET') {
    return res.redirect(config.redirectUrl);
  }

  next();
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
