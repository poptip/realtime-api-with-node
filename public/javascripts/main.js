$(document).ready(function() {
  // Get filter from URL
  var filter = window.location.href.split('/')[3];

  // Connect to socket.io
  var socket = io.connect();


  // Request to subscribe to new tweets from this particular user stream
  // with the filter requested.
  socket.emit('subscribe', filter, function(confirmation) {

    // If the server confirms this request, then start listening to new tweets
    if (confirmation) {

      // On new tweet, display it on the page
      socket.on('newTweet', function(tweet) {
        $('.handle').html(tweet.user.screen_name);
        $('.tweet').html(tweet.text);
      })
    }
  });
});