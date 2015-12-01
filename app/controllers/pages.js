'use strict';

module.exports.main = function(req, res) {
  res.render('pages/main.html', {
    title: 'Create a Fiscal Data Package'
  });
};

module.exports.about = function(req, res) {
  res.render('pages/about.html', {
    title: 'About'
  });
};

module.exports.templates = function(req, res) {
  var path = req.params[0];
  res.render('partials/' + path);
};