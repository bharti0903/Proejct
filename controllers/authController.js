const bcrypt = require("bcryptjs");
const User = require("../models/User");

const getLoginPage = (req, res) => {
  res.render("store/login", {
    error: null,
    success: null,
  });
};

const getSignupPage = (req, res) => {
  res.render("store/signup", {
    error: null,
    success: null,
  });
};

const signup = async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.render("store/signup", {
        error: "All fields are required",
        success: null,
      });
    }

    if (password.length < 6) {
      return res.render("store/signup", {
        error: "Password must be at least 6 characters long",
        success: null,
      });
    }

    if (password !== confirmPassword) {
      return res.render("store/signup", {
        error: "Passwords do not match",
        success: null,
      });
    }

    const existingUser = await User.findOne({
      email: String(email).toLowerCase().trim(),
    });

    if (existingUser) {
      return res.render("store/signup", {
        error: "User already exists with this email",
        success: null,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      password: hashedPassword,
    });

    return res.render("store/login", {
      error: null,
      success: "Signup successful. Please login.",
    });
  } catch (error) {
    console.error("SIGNUP ERROR:", error);
    return res.render("store/signup", {
      error: "Signup failed",
      success: null,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render("store/login", {
        error: "Email and password are required",
        success: null,
      });
    }

    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
    });

    if (!user) {
      return res.render("store/login", {
        error: "Invalid email or password",
        success: null,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.render("store/login", {
        error: "Invalid email or password",
        success: null,
      });
    }

    req.session.userId = user._id.toString();
    req.session.userName = user.name;

    return res.redirect("/dashboard");
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.render("store/login", {
      error: "Login failed",
      success: null,
    });
  }
};

const logout = (req, res) => {
  req.session.destroy(() => {
    return res.redirect("/login");
  });
};

module.exports = {
  getLoginPage,
  getSignupPage,
  signup,
  login,
  logout,
};