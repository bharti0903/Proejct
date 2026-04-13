const express = require("express");
const path = require("path");
const http = require("http");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const dotenv = require("dotenv");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const { initSocket } = require("./sockets");


dotenv.config();
connectDB();

const dashboardRoutes = require("./routes/dashboardRoutes");
const authRoutes = require("./routes/authRoutes");
const screenTimeRoutes = require("./routes/screenTimeRoutes");
const reportRoutes = require("./routes/reportRoutes");
const alertRoutes = require("./routes/alertRoutes");
const challengeRoutes = require("./routes/challengeRoutes");
const profileRoutes = require("./routes/profileRoutes");
const focusRoutes = require("./routes/focusRoutes");
const extensionRoutes = require("./routes/extensionRoutes");
const trackingRuleRoutes = require("./routes/trackingRuleRoutes");
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

initSocket(io);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.use((req, res, next) => {
  res.locals.currentUser = req.session.userName || null;
  res.locals.userId = req.session.userId || null;
  next();
});

app.get("/", (req, res) => {
  if (req.session.userId) {
    return res.redirect("/dashboard");
  }
  return res.redirect("/login");
});

app.use("/", dashboardRoutes);
app.use("/", authRoutes);
app.use("/", screenTimeRoutes);
app.use("/", reportRoutes);
app.use("/", alertRoutes);
app.use("/", challengeRoutes);
app.use("/", profileRoutes);
app.use("/", focusRoutes);
app.use("/", extensionRoutes);
app.use("/", trackingRuleRoutes);

app.use((req, res) => {
  res.status(404).render("404");
});

const PORT = process.env.PORT || 5002;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});