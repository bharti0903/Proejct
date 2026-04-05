const bcrypt = require("bcryptjs");
const User = require("../models/User");

const getLoginPage = (req, res) => {
  res.render("auth/login", { error: null });
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!user) {
      return res.render("auth/login", {
        error: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.render("auth/login", {
        error: "Invalid email or password",
      });
    }

    req.session.userId = user._id;
    req.session.userName = user.name;

    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.render("auth/login", {
      error: "Login failed",
    });
  }
};

const getSignupPage = (req, res) => {
  res.render("auth/signup", { error: null });
};

const signupUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;

    const fullName = `${firstName || ""} ${lastName || ""}`.trim();

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.render("auth/signup", {
        error: "All fields are required",
      });
    }

    if (password !== confirmPassword) {
      return res.render("auth/signup", {
        error: "Passwords do not match",
      });
    }

    if (password.length < 6) {
      return res.render("auth/signup", {
        error: "Password must be at least 6 characters long",
      });
    }

    const existingUser = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (existingUser) {
      return res.render("auth/signup", {
        error: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name: fullName,
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      dailyLimit: 4,
      warningLimit: 3,
      dangerLimit: 4,
      currentStreak: 0,
      bestStreak: 0,
      lastStreakDate: null,
    });

    res.redirect("/login");
  } catch (error) {
    console.error("SIGNUP ERROR:", error);
    res.render("auth/signup", {
      error: "Signup failed",
    });
  }
};

const logoutUser = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.redirect("/");
    }
    res.redirect("/login");
  });
};

module.exports = {
  getLoginPage,
  loginUser,
  getSignupPage,
  signupUser,
  logoutUser,
};