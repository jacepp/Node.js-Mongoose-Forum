/**
 * Module dependencies.
 */

var express = require('express')
  , http = require('http')
  , path = require('path')
  , mongoose = require('mongoose')
  , passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy
  , flash = require('connect-flash')
  , crypto = require('crypto');

var app = express();

var db = mongoose.createConnection('localhost', 'test');

var Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId;

var threadSchema = new Schema({
  title: String,
  content: String,
  author: String,
  date: {type: Date, default: Date.now }
});

var commentSchema = new Schema({
  content: String,
  author: String,
  thread: [{ type: Schema.Types.ObjectId, ref: 'Thread' }],
  date: {type: Date, default: Date.now }
});

var accountSchema = new Schema({
  username: String,
  password: String,
  email: String
});

var Thread = db.model('Thread', threadSchema)
  , Comment = db.model('Comment', commentSchema)
  , Account = db.model('Account', accountSchema);

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.cookieParser('roar'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.session({secret: 'jacepp'}));
  app.use(flash());
  app.use(passport.initialize());
  app.use(passport.session());
});

var getHash = function(password, cb) {
  crypto.pbkdf2(password, "mmmSalty", 2048, 40, cb);
};

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', function(req, res){
  res.sendfile(__dirname + '/views/index.html');
});

app.get('/login', function(req, res){
  res.sendfile(__dirname + '/views/login.html');
});

app.get('/register', function(req, res){
  res.sendfile(__dirname + '/views/register.html');
});

app.get('/home', function(req, res){
  res.sendfile(__dirname + '/views/home.html');
});

app.get('/view-all', function(req, res){
  res.sendfile(__dirname + '/views/all.html');
});

app.get('/thread', function(req, res){
  res.sendfile(__dirname + '/views/thread.html');
});

app.post('/login-user', function(req, res){
  console.log(req.body);

});

app.post('/register-user', function(req, res){
  console.log(req.body);
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
        req.flash('error', 'Your password and comfirm password do not match.');
        res.redirect('/register');
    }
  } else {
      req.flash('error', 'You forgot something.');
      res.redirect('/register');
  }
});

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
