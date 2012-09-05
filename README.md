## Realtim API with Node & Socket.io
====================================

If you've worked with node.js it's very likely you've used socket.io, the "magical" tool that let's you very easily send real-time content between the server and client (and vice versa) with ease.

You've probably seen something like this:

Server:

```js
var io = require('socket.io').listen(app);
io.sockets.on('connection', function(socket) {
  socket.emit('hello', { text: 'world' });
  socket.on('helloagain', function(data) {
    console.log(data);
  })
})
```

Client:

```js
var socket = io.connect();
socket.on('hello', function(data) {
  // do something
})
```

And for the most part, this covers the majority of entry level use cases.  It's really great for single page applications, where you want to allow concurrent users interact with one another (e.g. chat room).  It's also can be easier and faster to use than standard RESTful calls or AJAX requests.

socket.io already comes with a lot of awesome stuff: namespaces, rooms, authorization, etc.

But at [poptip](http://poptip.com) we work with huge data sets.  Massive volumes of tweets flood our system daily.  They have to be processed, stored, and served to the client in realtime.  So it's extremely important that when a client connects to our server, they be sent the relevant data in real time.  Node is really excellent at handling massive volumes of concurrent users, but that doesn't mean we can get sloppy with the data being transmitted.

Using the "standard" scheme from above just wont work.  We could get an initial data dump of relevant data, but to ensure that new data be pushed to the client, especially if the queuries are complicated, it will get messy if this isn't managed.

This is why we use a subscription model.

When the client makes a request to a page (let's say yoursite.com/post/:id/comments), it will emit the following:

```js
socket.emit('subscribe', {
  // unique identifier for this subscription
  // this is useful if the client wants to subscribe to the same collection
  // more than once on the same page
  uid: this.uid

  // the model which the client is requesting updates from
, collection: 'comment'

  // object of documents that the client already has. contains document `id` as key and the `mtime` as the value.
, documents: {
    '47cc67093475061e3d95369d': '1346881868'
  , '47dd6709adf398c23ae932e9': '1346881234'
  }

  // properties from the model which you want updates from.
  // notice the namespacing.
  // some fields will not be available when requested from the server,
  // such as `user.email`.
, fields: [ 
    'user.id'
  , 'user.name'
  , 'user.avatar'
  , 'message'
  ]

  // what new documents from this model to subscribe to
, createQuery: { topicID: '47dd6709adf398ba346d4s' }
});
```

We will also bind the following:

```js
socket.on(this.uid + ':' + this.name + ':save', this._onSave.bind(this));
socket.on(this.uid + ':' + this.name + ':create', this._onCreate.bind(this));
socket.on(this.uid + ':' + this.name + ':destroy', this._onDestroy.bind(this));
```

Now, very quickly, we've established a way to let the server know the type of data we want updates to, as well as associate some additional functions to the client based on messages from the server.

Now, for the server side.

We define some "subscription" service, which is bound to a particular socket object.

```js
module.exports = function(socket, args) {
  socket.on('subscribe', function(data) {
    // Select the "collection" of data
    var Collection = collections[data.collection];
    // cache most recently used documents
    var collectionCache = cache[data.collection];
    ...
    ...
    ...
    // For every document we want updates from
    Hash(data.documents).forEach(function(mtime, id) {
      // check the cache first
      var event = collectionCache.get(id);
      if (event) {
        // there is a possible race condition for the case which the client
        // gets a version of the document and it gets updated from the time
        // when that page is requested to when they connected through socket.io
        if (event.action === 'update' && event.doc.mtime > mtime) {
          // if the document is updated during that time, tell the client
          onSave(socket, data, Collection, event.doc);
        } else if (event.action === 'destroy') {
          // if it's destroyed, let the client know too
          onDestroy(socket, data, id);
          return;
        }
      }

      // Subscribe to all changes
      subscribeToDoc(socket, data, listeners, Collection, id);
    });
  })
}
```

Each socket (an individual user connected to our application) now establishes a subscription relationship, such that when the user commits a change on the client, it will reflect on the server (whether that's some action or a database call), and when an update occurs on the server (again, whether that is some action or an update to the database) that will be emitted to all sockets which are "listening" for updates to that collection with any and all particular filters.

Communication back to the client occurs as such:

```js
function emitUpdate(socket, data, doc) {
  return function() {
    socket.emit(data.uid + ':' + data.collection + ':save', doc);
  };
}
```

=====

In this repository, we are simplifying these concepts, and instead are focusing on a single data source, and serving "portions" of that data to the user, depending on the request they make.

This app uses a twitter user stream, which will send new tweets to the client.  The twist, however, is that with one stream, the experience each concurrent user has will be unique to the url they are requesting.

myawesomesite.com/nfl returns all tweets containing the string "nfl"
myawesomesite.com/nyc returns all tweets containing the string "nyc"
myawesomesite.com/url returns all tweets containing a url

Instead of using the subscription model, we are going to use the "room" feature, so that we can target specific users dynamically.
