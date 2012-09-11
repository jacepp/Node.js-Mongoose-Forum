/*
 * GET register page.
 */

exports.register = function(req, res){
  res.render('register.jade', {message: req.flash('error')});
};