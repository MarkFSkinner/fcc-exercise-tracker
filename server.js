const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const moment = require('moment');
const cors = require('cors');

const mongo = require('mongodb');
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGOLAB_URI || 'mongodb://localhost/exercise-track' );

app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});


const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: {type: String, required: true, unique: true},
  _id: {type: String, required: true, unique: true},
  log: [{
    description: {type: String},
    duration: {type: Number},
    date: {type: Date}
  }]
});

const User = mongoose.model("User", userSchema, "users");

app.post("/api/exercise/new-user", async (req, res) => {
  const username = req.body.username;
  if (username === "") {
    return res.send("Username is required");
  }
  try {
    let dbEntry = await User.findOne({username: username}).exec();
    if (dbEntry !== null) {
      return res.send("Sorry, username already taken!");
    }
    const _id = Math.random().toString(36).substr(2, 9);
    const userData = {
      username: username,
      _id: _id
    }
    const user = new User(userData);
    try {
      await user.save();
    } catch (err) {
      if (err.code === 11000) {
        dbEntry = await User.findOne({username: username}).exec();
        return res.json({"username": dbEntry.username, _id: dbEntry._id});
      } else {
        throw err;
      }
    }
    return res.json(userData);
  } catch (err) {
      res.send("Database error: " + err);
  }
});

app.post("/api/exercise/add", async (req, res) => {
  const userId = req.body.userId;
  const description = req.body.description;
  const duration = req.body.duration;
  const date = req.body.date;
  let formatedDate = new Date(date);
  if (userId === "") {
    return res.send("userId is required");
  }
  try {
    let dbEntry = await User.findOne({_id: userId}).exec();
    if (dbEntry === null) {
      return res.send("userId not found");
    }
    const username = dbEntry.username;
    if (description === "") {
      return res.send("description is required");
    }
    if (duration === "") {
      return res.send("duration is required");
    }
    if (duration < 1) {
      return res.send("Duration too short. Minimum of 1 minute required");
    }
    if (date === "") {
      formatedDate = new Date();
    }
    if (formatedDate === "Invalid Date") {
      return res.send("Invalid Date");
    }
    const exerciseData = {
      description: description,
      duration: duration,
      date: formatedDate
    };
    await User.findByIdAndUpdate(userId, { "$push": {log: exerciseData}}, {new: true, upsert: true});
    res.json({username: username, _id: userId, description: description, duration: duration, date: moment(formatedDate).format("dddd, MMMM Do YYYY")});
  } catch (err) {
    res.send("Database error: " + err);
  }
});

app.get("/api/exercise/log?:userId", async (req, res) => {
  const userId = req.query.userId;
  const fromDate = req.query.from === undefined ? "Invalid Date" : new Date(req.query.from);
  const toDate = req.query.to === undefined ? "Invalid Date" : new Date(req.query.to);
  const limit = Number(req.query.limit);
  let dbEntry = await User.findOne({_id: userId}).exec();
  if (dbEntry === null) {
    return res.send("User not found");
  }
  let logs = dbEntry.log;
  if (fromDate !== "Invalid Date") {
    logs = logs.filter(entry => entry.date >= fromDate);
  }
  if (toDate !== "Invalid Date") {
    logs = logs.filter(entry => entry.date <= toDate);
  }
  logs.sort((a, b)=> {
    return b.date - a.date;
  });
  let count = logs.length;
  if (!isNaN(limit) && count > limit) {
    logs = logs.slice(0, limit);
    count = limit;
  }
  const displayLogs = logs.map(entry => {
    return {description: entry.description, duration: entry.duration, date: moment(entry.date).format("dddd, MMMM Do YYYY")};
  });
  res.json({username: dbEntry.username, _id: userId, count: count, log: displayLogs});
});


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
