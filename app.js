/**
 * Module dependencies.
 */

var express = require('express')
  , http = require('http')
  , path = require('path')
  , mongoose = require('mongoose')
  , crypto = require('crypto')
  , routes = require('./routes')
  , socket = require('socket.io')
  , MongoStore = require('connect-mongo')(express);

var app = express();

var db = mongoose.createConnection('mongodb://nodejitsu:2015f5b0193ede03b20ec81b189cbf82@alex.mongohq.com:10040/nodejitsudb20534191509');

var conf = { 
  db: {
    db: 'nodejitsudb930196683980',
    host: 'alex.mongohq.com',
    port: 10015,  
    username: 'nodejitsu',
    password: 'e56e06f60d86e6075e6eb21b1790fabd', 
    collection: 'mySessions' 
  },
  secret: '076ee61d63aa10a125ea872411e433b9'
};

var dbUrl = 'mongodb://';
dbUrl += conf.db.username+':'+conf.db.password+'@';
dbUrl += conf.db.host+':'+conf.db.port;
dbUrl += '/' + conf.db.db;
mongoose.connect(dbUrl);
mongoose.connection.on('open', function () {
  app.listen(1337);
});

var Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId;

var threadSchema = new Schema({
  topic: String,
  content: String,
  author: String,
  date: {type: Date, default: Date.now }
});

var commentSchema = new Schema({
  body: String,
  user: String,
  thread: [{ type: Schema.Types.ObjectId, ref: 'Thread' }],
  date: {type: Date, default: Date.now }
});

var accountSchema = new Schema({
  username: String,
  password: String,
  email: {type: String, index: {unique: true}}
});

var sessionSchema = new Schema({
  author: String,
  date: {type: Date, default: Date.now }
});

var Thread = db.model('Thread', threadSchema)
  , Comment = db.model('Comment', commentSchema)
  , Account = db.model('Account', accountSchema)
  , Session = db.model('Session', sessionSchema);

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.cookieParser('roar'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.session({
    secret: conf.secret,
    maxAge: new Date(Date.now() + 3600000),
    store: new MongoStore(conf.db)
  }));
  app.use(app.router);
});

var getHash = function(password, cb) {
  crypto.pbkdf2(password, "mmmSalty", 2048, 40, cb);
};

app.configure('development', function(){
  app.use(express.errorHandler());
});

var server = http.createServer(app);
server.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

var io = socket.listen(server);

app.get('/', routes.index);
app.get('/login', function(req, res){
  res.render('login');
});

app.get('/register', function(req, res){
  res.render('register');
});

app.get('/home', function(req, res){
  if(req.session.author){
    Thread.find().sort('-date').limit(10).execFind(function(err, threads){
      Comment.find().sort('-date').limit(10).execFind(function(err, comments){
        if(threads.length && comments.length)
          res.render('home', {threads: threads, comments: comments});
        else if(!threads.length && comments.length)
          res.render('home', {threads: null, comments: comments});
        else if(threads.length && !comments.length)
          res.render('home', {threads: threads, comments: null});
        else
          res.render('home', {threads: null, comments: null});
      });
    });
  } else {
      res.render('index');
  }    
});

app.get('/all', function(req, res){
  if(req.session.author){
    Thread.find().sort('-date').execFind(function(err, threads){
      res.render('all', {threads: threads});
    });
  } else {
      res.render('index');
  }   
});

app.get('/thread/:id', function(req, res){
  if(req.session.author)
    Thread.findOne({'_id': req.params.id}, function(err, thread){
      Comment.find({'thread.0': thread._id}).sort('-date').execFind(function(err, comments){
        if(comments.length)
          res.render('thread', {id: thread._id, topic: thread.topic, content: thread.content, author: thread.author, date: thread.date, comments: comments});
        else
          res.render('thread', {id: thread._id, topic: thread.topic, content: thread.content, author: thread.author, date: thread.date, comments: null});
      });      
    }); 
  else
    res.render('index'); 
});

app.get('/new-thread', function(req, res){
  if(req.session.author)
    res.render('new-thread');
  else
    res.render('index'); 
});

app.get('/comment/:id', function(req, res){
  if(req.session.author)
    res.render('comment', {id: req.params.id});
  else
    res.render('index');
});

app.get('/sign-out', function(req, res){
  req.session.destroy();
  res.render('index');
});

app.post('/login-user', function(req, res){
  if(req.body.email && req.body.password){
    getHash(req.body.password, function(err, hash){
      Account.findOne({'email': req.body.email}, function(err, account){
        if(account.password == hash){
          req.session.author = account.username;
          res.redirect('/home');
        } else {
          res.redirect('/login');
        }           
      });      
    });  
  } else {
    res.redirect('/login');
  }
});

app.post('/register-user', function(req, res){
  if(req.body.name && req.body.email && req.body.password && req.body.confirm){
    if(req.body.confirm === req.body.password){
      getHash(req.body.password, function(err, hash){
        var newAccount = new Account();
        newAccount.username = req.body.name;
        newAccount.password = hash;
        newAccount.email = req.body.email;
        newAccount.save();

        res.redirect('/login');
      });
    } else {
        res.redirect('/register');
    }
  } else {
      res.redirect('/register');
  }
});

app.post('/new-thread', function(req, res){
  var newThread = new Thread();
  newThread.topic = req.body.topic;
  newThread.content = req.body.content;
  newThread.author = req.session.author;
  newThread.save();

  Account.findOne({'_id': newThread._id}, function(err, account){
    io.sockets.emit('new_thread', account);
  });
  res.redirect('/thread/' + newThread._id);
});

app.post('/add-comment/:id', function(req, res){
  var newComment = new Comment();
  newComment.body = req.body.body;
  newComment.user = req.session.author;
  newComment.thread = req.params.id;
  newComment.save();
  res.redirect('/thread/' + req.params.id);
});

io.on('connection', function(socket) {
  socket.on('new_comment', function(data) {
    
  });
});