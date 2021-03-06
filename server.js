var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
const PORT = process.env.PORT || 3000;

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

let letters = [];
let lettersByName = [];
let players = [];
let kalkal = {};
let interval = null;
let restartRequest = {};
let draw={};
let playerLeft={};
let state ='waiting';
let goal = null;
let timeLeft=60*3;
let timer;

function calculate(){
  letters = [];
  lettersByName = [];
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
}

io.on('connection', function (socket) {
  socket.on('addPlayer', function (val, fields) {
    let player = players.find(f=>f.name === val)
    if(playerLeft[val]){
      clearTimeout(playerLeft[val]);
      delete playerLeft[val];
      let player = players.find(f=>f.name === val);
      player.id = socket.id;
    } else if(player){
      player.id = socket.id
    } else {
      players.push({
        id: socket.id, name: val, overall: 0,
        entities: fields.reduce((a, c) => { a[c] = ""; return a }, {})
      });
    }
    io.emit('addPlayer', socket.id, val, state, goal);
    clearInterval(interval);
    interval = setInterval(()=>{
      players.forEach(f=>{
        io.emit('addPlayer', f.id, f.name, state, goal);
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

      if (kalkal[id + e].length >= (Math.floor(players.length/2) + 1)) {
        
        player.entities[e] = '';
        player.currentScore -= 20;
        player.overall -= 20;
        io.emit('updateScores', players);
      }
    }
  })
  socket.on('draw', function(){
    draw[socket.id]=true;
    if(Object.keys(draw).length>=players.length){
      clearInterval(timer);
      calculate();
      io.emit('hop', socket.id, players);
      state = 'results';
    }
  })
  socket.on('select',function(){
    state = 'select';
  })
  socket.on('restart', function (fields) {
    restartRequest[socket.id]=true;
    if(Object.keys(restartRequest).length>=players.length){
      restartRequest={};
      kalkal = {};
      draw = {};
      players.forEach(f=>f.entities = fields.reduce((a, c) => { a[c] = ""; return a }, {}));
      io.emit('restart');
      state = "select";
    }
  })
  socket.on('chat', function (msg) {
    io.emit('chat', socket.id, msg);
  });
  socket.on('hop', function () {
    clearInterval(timer);
    calculate();
    io.emit('hop', socket.id, players);
    state = 'results';
  });
  socket.on('changeField', function (k, v) {
    let player = players.find(f => f.id === socket.id)
    if(player){
      player.entities[k] = v;
    }
  });
  socket.on('letterSelection', function (msg) {
    clearInterval(interval);
    draw={};
    let player = players.find(f=>f.id === socket.id);
    if(player){
      lettersByName.push({name:player.name, msg});
    }
    letters.push(msg)
    io.emit('letterSelection', socket.id, lettersByName);
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
      lettersByName = [];
      io.emit('gameStart', socket.id, selected.letter);
      goal = selected.letter;
      state = "game";
      timeLeft = 60*3;
      timer = setInterval(()=>{
        timeLeft--;
        io.emit('timeleft',timeLeft)
        console.log('aaaaaaaaa')
        if(timeLeft<0){
          clearInterval(timer);
          delete timer;
          calculate();
          io.emit('hop', socket.id, players);
          state = 'results';
        }
      },1000)
    }
  });
  socket.on('disconnect', function () {
    let player = players.find(f => f.id === socket.id);
    if(!player) return;
    playerLeft[player.name] = setTimeout(()=>{
      players = players.filter(f => f.id !== socket.id);
      io.emit('removePlayer', socket.id);
      delete playerLeft[player.name]
      if(players.length===0){
        state ='waiting';
      }
    },5000)
  });
});

http.listen(PORT, function () {
  console.log('listening on *:'+PORT);
});