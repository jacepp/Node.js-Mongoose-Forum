/*
 * GET register page.
 */

exports.register = function(req, res){
  res.render('register', {message: req.flash('error')});
};