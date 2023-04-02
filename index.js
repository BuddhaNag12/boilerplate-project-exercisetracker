const express = require('express');
const app = express();
const bodyParser = require('body-parser');
require('dotenv').config()
const cors = require('cors');

const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true }).then(()=>{
  console.log('mongodb connected')
}).catch((e)=>{
  console.error(e)
})

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

const Schema = mongoose.Schema;

const exerciseUsersSchema = new Schema({
  username: { type: String, unique: true, required: true }
});

const ExerciseUsers = mongoose.model('ExerciseUsers', exerciseUsersSchema);

const exercisesSchema = new Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, min: 1, required: true },
  date: { type: Date, default: Date.now }
});

const Exercises = mongoose.model('Exercises', exercisesSchema);

app.post('/api/users', function(req, res) {
  if (req.body.username === '') {
    return res.json({ error: 'username is required' });
  }

  let username = req.body.username;
  let _id = '';

  ExerciseUsers.findOne({ username: username }).then(data => {
    if (data === null) {
      const newUser = new ExerciseUsers({
        username: username
      });
      newUser.save().then(user => {
        res.status(200).json({ 
          username: user.username,
          _id: user._id
         })
      })
    } else {
      res.status(401).json({ error: 'username already exists' });
    }
  }).catch(err => {
    console.log(err);
  })
});

app.get('/api/users', function(req, res) {
  ExerciseUsers.find().then((data)=>{
    res.json(data);
  })
});

app.post('/api/users/:_id/exercises', function(req, res) {
  if (req.params._id === '0') {
    return res.json({ error: '_id is required' });
  }

  if (req.body.description === '') {
    return res.json({ error: 'description is required' });
  }

  if (req.body.duration === '') {
    return res.json({ error: 'duration is required' });
  }

  let userId = req.params._id;
  let description = req.body.description;
  let duration = parseInt(req.body.duration);
  let date = (req.body.date !== undefined ? new Date(req.body.date) : new Date());

  if (isNaN(duration)) {
    return res.json({ error: 'duration is not a number' });
  }

  if (date == 'Invalid Date') {
    return res.json({ error: 'date is invalid' });
  }
  if(!userId) return res.status(400).json({error:"User id not found"})
  ExerciseUsers.findById(userId).then((data)=>{
    if (data !== null) {
      let newExercise = new Exercises({
        userId: userId,
        description: description,
        duration: duration,
        date: date
      });
      newExercise.save().then((data2)=>{
        res.json({
          _id: data['_id'],
          username: data['username'],
          description: data2['description'],
          duration: data2['duration'],
          date: new Date(data2['date']).toDateString()
        });
      })
    } else {
      return res.json({ error: 'user not found' });
    }
  })
});

app.get('/api/users/:_id/exercises', function(req, res) {
  res.redirect('/api/users/' + req.params._id + '/logs');
});

app.get('/api/users/:_id/logs', function(req, res) {
  let userId = req.params._id;
  let findConditions = { userId: userId };

  if (
    (req.query.from !== undefined && req.query.from !== '')
    ||
    (req.query.to !== undefined && req.query.to !== '')
  ) {
    findConditions.date = {};

    if (req.query.from !== undefined && req.query.from !== '') {
      findConditions.date.$gte = new Date(req.query.from);
    }

    if (findConditions.date.$gte == 'Invalid Date') {
      return res.json({ error: 'from date is invalid' });
    }

    if (req.query.to !== undefined && req.query.to !== '') {
      findConditions.date.$lte = new Date(req.query.to);
    }

    if (findConditions.date.$lte == 'Invalid Date') {
      return res.json({ error: 'to date is invalid' });
    }
  }

  let limit = (req.query.limit !== undefined ? parseInt(req.query.limit) : 0);

  if (isNaN(limit)) {
    return res.json({ error: 'limit is not a number' });
  }

  ExerciseUsers.findById(userId).then((data)=>{
    if (data !== null) {
      Exercises.find(findConditions).sort({ date: 'asc' }).limit(limit).exec().then((data2)=>{
        return res.json({
          _id: data['_id'],
          username: data['username'],
          log: data2.map(function(e) {
            return {
              description: e.description,
              duration: e.duration,
              date: new Date(e.date).toDateString()
            };
          }),
          count: data2.length
        });
      })
    } else {
      return res.json({ error: 'user not found' });
    }
  })
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: 'not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || 'Internal Server Error';
  }

  res.status(errCode).type('txt')
    .send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});