// Dependencies
var express = require('express')
  , app = module.exports = express.createServer()
  , routes = require('./routes')
  , io = require('socket.io').listen(app)
  , twitter = require('ntwitter')
  , filters = []
  , mu = require('mu2')
  , util = require('util')
  ;

// Configurations
app.configure(function(){
  mu.root = __dirname + '/views';
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});






// Routes
app.get('/', routes.index);
// We want to have a route that will handle any arbitrary endpoint
app.get('/:type', routes.index);


// Create a new instance of the ntwitter Twitter client
var twit = new twitter({
  consumer_key: '6PO49aLzOeWbX73MElJdA',
  consumer_secret: 'J36S8dT7UOf1nsd8tWtks8ht2KEQ9IxKgNWbUh5phQk',
  access_token_key: '207708725-3Kq2aWkGcolr2goSoLk2VDXYFnRew0QjsyQDDTdV',
  access_token_secret: '8X0JtJcfYFnFI50eaNiI5QFTMHkJ5Hv9FkhKyz0Vw'
});

// Start a new user stream using the provided credentials.
// Twitter will push new data through this stream.
twit.stream('user', function(stream) {
  
  // When new data comes in (ie a tweet)
  // we will check to see if the tweet contains one of the filters that
  // is currently being accessed, and if so, send it to all clients
  // who are "subscribed" to that filter.
  stream.on('data', function (data) {
    var text = data.text;

    if (filters.length > 0) {
      filters.forEach(function(filter) {
        if (text.match(filter)) {
          // This particular socket.io command allows us to
          // emit from the entire socket.io instance to all clients
          // who are subscribed to this particular filter
          io.sockets.in(filter).emit('newTweet', data);
        }
      });
    }

    io.sockets.in('all').emit('newTweet', data);
  });

  // end protocol
  stream.on('end', function (response) {
    console.log('end');
    stream.destroy;
  });

  // destroy protocol
  stream.on('destroy', function (response) {
    console.log('destroy');
    stream.destroySilent;
  });
});

// Whenever a new client connects to our server...
io.sockets.on('connection', function(socket) {

  // They will emit a request to "join." This here is the
  // subscription in action.
  socket.on('subscribe', function(filter, callback) {

    // We attach this particular filter to the socket and
    // have it "join" that room.  socket.io rooms will allow us
    // to target specific users.  This is a drastic simplification
    // of the subscription process we discussed earlier, but similar in
    // theory and utility.
    socket.room = filter;
    socket.join(filter);

    // Add this particular filter to our array of filters if doesn't exist
    if (filters.indexOf(filter) == -1 )
      filters.push(filter);
    
    // Confirm the subscribe request
    callback(true);

  });
})

// Run app
var port = process.env.PORT || 3000;
app.listen(port);
console.log('Server Running on port  ' + port);