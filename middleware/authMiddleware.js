exports.protect = (req, res, next) => {
  if (req.session && (req.session.user || req.session.userId)) {
    return next();
  }

  return res.redirect("/login");
};