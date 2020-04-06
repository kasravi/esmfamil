var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
const PORT = process.env.PORT || 3000;

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

let letters = [];
let players = [];
let kalkal = {};
let interval = null;
let restartRequest = {};

io.on('connection', function (socket) {
  socket.on('addPlayer', function (val, fields) {
    players.push({
      id: socket.id, name: val, overall: 0,
      entities: fields.reduce((a, c) => { a[c] = ""; return a }, {})
    });
    io.emit('addPlayer', socket.id, val);
    clearInterval(interval);
    interval = setInterval(()=>{
      players.forEach(f=>{
        io.emit('addPlayer', f.id, f.name);
      })
    },100)
  })
  socket.on('kalkal', function (id, e) {
    let player = players.find(f => f.id === id);
    if(!player || player.entities[e]===''){
      return;
    }
    if (!kalkal[id + e]) kalkal[id + e] = [];
    if (kalkal[id + e].indexOf(socket.id) < 0) {
      kalkal[id + e].push(socket.id);
      io.emit('kalkal', kalkal)

      if (kalkal[id + e].length >= (players.length - 1)) {
        
        player.entities[e] = '';
        player.currentScore -= 20;
        player.overall -= 20;
        io.emit('updateScores', players);
      }
    }
  })
  socket.on('restart', function (fields) {
    restartRequest[socket.id]=true;
    if(Object.keys(restartRequest).length>=players.length){
      restartRequest={};
      players.forEach(f=>f.entities = fields.reduce((a, c) => { a[c] = ""; return a }, {}));
      io.emit('restart');
    }
  })
  socket.on('chat', function (msg) {
    io.emit('chat', socket.id, msg);
  });
  socket.on('hop', function () {
    letters = [];
    var entityByFieldandValue = {};
    players.forEach(player => {
      Object.entries(player.entities).forEach(e => {
        k = e[0];
        v = e[1];
        if (!entityByFieldandValue[k + v]) entityByFieldandValue[k + v] = 0;
        entityByFieldandValue[k + v]++;
      })
    })
    players.forEach(player => {
      player.currentScore = Object.values(player.entities).filter(f => f !== "").length * 10;
      Object.entries(player.entities).forEach(e => {
        k = e[0];
        v = e[1];
        if (entityByFieldandValue[k + v] > 1 && v != "") {
          player.currentScore -= 5;
        }
      })
      player.overall += player.currentScore;
    });
    io.emit('hop', socket.id, players);
  });
  socket.on('changeField', function (k, v) {
    let player = players.find(f => f.id === socket.id)
    if(player){
      player.entities[k] = v;
    }
  });
  socket.on('letterSelection', function (msg) {
    clearInterval(interval);

    letters.push(msg);
    io.emit('letterSelection', socket.id, letters);
    if (letters.length >= players.length) {
      let selected = letters.reduce((a, i) => {
        a[i] = a[i] ? a[i] + 1 : 1;
        if (a[i] > a.max) {
          a.letter = i;
          a.max = a[i];
        }
        return a;
      }, { max: -1, letter: '' })
      letters = [];
      io.emit('gameStart', socket.id, selected.letter);
    }
  });
  socket.on('disconnect', function () {
    players = players.filter(f => f.id !== socket.id);
    io.emit('removePlayer', socket.id)
  });
});

http.listen(PORT, function () {
  console.log('listening on *:'+PORT);
});