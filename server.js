var express = require('express');
var request = require('request');
var cheerio = require('cheerio');
var dateFormat = require('dateformat');
var app = express();
var env = process.env.NODE_ENV || 'development';

var picturesCache;
var scrapeUrl = 'http://sisproject.berkeley.edu/team';

var sendError = function(res, errorMessage) {
  res.send({
    'type': 'error',
    'message': errorMessage
  });
};

var parsePictures = function(body) {
  var $ = cheerio.load(body);

  var pictures = [];

  $('table[cellpadding="3"] td:has(img)').each(function() {
    var image = $('img', this).attr('src');
    if (image.lastIndexOf('/sites/', 0) === 0) {
      image = 'http://sisproject.berkeley.edu' + image;
    }
    var picture = {
      image: image,
      // Temp fix, we need this for Jocelyn Newman
      name: $('strong', this).text() || $('b', this).text(),
      title: $('a', this).text()
    };
    pictures.push(picture);
  });

  return pictures;
};

var sendPictures = function(res) {
  var now = new Date();
  res.send({
    devInfo: {
      date: dateFormat(now, 'isoDateTime'),
      scrapeUrl: scrapeUrl
    },
    pictures: picturesCache
  });
}

var getPictures = function(res) {
  var now = new Date();
  console.log(dateFormat(now, 'isoDateTime') + ' - Getting the pictures');
  request({
    url: scrapeUrl
  }, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      picturesCache = parsePictures(body);
      if (res) {
        sendPictures(res);
      }
    }
  });
};

/**
 * Since we're showing personal pictures, make sure we only pass data over https
 */
var forceSSL = function(req, res, next) {
  if (req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(['https://', req.get('Host'), req.url].join(''));
  }
  return next();
};

var allowCrossDomain = function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

  // intercept OPTIONS method
  if ('OPTIONS' == req.method) {
    res.send(200);
  } else {
    next();
  }
};

// When in production, force SSL
if (env === 'production') {
  app.use(forceSSL);
}

app.use(allowCrossDomain);
app.get('/api/pictures', function(req, res) {
  if (!picturesCache) {
    getPictures(res);
  } else {
    sendPictures(res);
  }
});

app.get('/', function(req, res) {
  res.send({
    'api': req.protocol + '://' + req.get('host') + '/api/pictures'
  });
});

var port = process.env.PORT || 3100;
app.listen(port);

setInterval(getPictures, 10000);
getPictures();
