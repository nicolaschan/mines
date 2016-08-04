'use strict';

const config = require('./config.json');
const async = require('async');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const shuffle = require('shuffle-array');
const chalk = require('chalk');
const clear = require('clear');
const hri = require('human-readable-ids').hri;
const clone = require('clone');
const randomcolor = require('randomcolor');
const Iron = require('iron');
const log4js = require('log4js');
const logger = log4js.getLogger();
const shortid = require('shortid');

const Games = require('./games');
const defaultGame = Games.createGame(config.board.width, config.board.height, config.board.mines, 'Default game');
defaultGame.doNotDelete = true;
defaultGame.unhide();

io.on('connection', (socket) => {
  var logger = log4js.getLogger(`User ${socket.handshake.address}, ID ${socket.id}`);
  var username;
  var game;

  socket.on('login', (credentials) => {
    async.series([(callback) => {
      // unseal the username (if it's there)
      logger.debug(`Logging in with credentials: ${JSON.stringify(credentials)}`);
      if (credentials.sealedUsername)
        Iron.unseal(credentials.sealedUsername, config.password, Iron.defaults, (err, unsealed) => {
          username = unsealed;
          if (err) {
            logger.warn(`Tampered with their username: ${err.message}`);
          }
          callback();
        });
      else
        callback();
    }, (callback) => {
      game = Games.getGame(credentials.gameId);
      if (!game)
        game = defaultGame;

      username = game.addPlayer(username).username;
      socket.join(game.gameId);
      logger.info(`Connected with username ${username} to game ${game.gameId}`);

      Iron.seal(username, config.password, Iron.defaults, (err, sealedUsername) => {
        socket.emit('set username', {
          username: username,
          sealedUsername: sealedUsername
        });
        io.to(game.gameId).emit('players', game.getPlayers());
        socket.emit('board', {
          board: game.getBoard().getSquaresForPlayer(),
          dimensions: game.getBoard().getDimensions()
        });
        io.to(game.gameId).emit('squares', game.board.getSquaresByPlayer(username));
        socket.emit('flag count', game.getBoard().flagCount);
        socket.emit('next dimensions', game.getNextDimensions());
        socket.emit('share game', {
          name: game.name,
          hidden: game.hidden,
          isDefaultGame: game == defaultGame
        });
      });
    }]);
  });


  socket.on('reveal', (coord) => {
    if (game.resetting)
      return;

    io.to(game.gameId).emit('squares', game.reveal(coord.x, coord.y, username));
    io.to(game.gameId).emit('flag count', game.getBoard().flagCount);
    io.to(game.gameId).emit('players', game.getPlayers());

    if (game.getBoard().lost) io.to(game.gameId).emit('lose', {
      loser: username,
      squares: game.getBoard().getRemainingSquares()
    });
    if (game.getBoard().won) io.to(game.gameId).emit('win', game.getWinner());

    if (game.getBoard().lost || game.getBoard().won) {
      game.resetting = true;
      setTimeout(() => {
        game.resetBoard();
        game.clearPlayerPoints();
        game.removeDisconnectedPlayers();
        game.resetting = false;
        io.to(game.gameId).emit('players', game.getPlayers());
        io.to(game.gameId).emit('board', {
          board: game.getBoard().getSquaresForPlayer(),
          dimensions: game.getBoard().getDimensions()
        });
        io.to(game.gameId).emit('flag count', game.getBoard().flagCount);
      }, 5000);
    }
  });
  socket.on('flag', (coord) => {
    game.toggleFlag(coord.x, coord.y);
    io.to(game.gameId).emit('flag count', game.getBoard().flagCount);
    io.to(game.gameId).emit('squares', [game.getBoard().getSquaresForPlayer()[coord.x][coord.y]]);
  });

  socket.on('disconnect', (message) => {
    if (game)
      game.playerDisconnected(username);
    logger.debug('Disconnected');
    Games.removeUnoccupiedGames();
  });
  socket.on('next dimensions', (dimensions) => {
    game.setNextDimensions(dimensions);
    io.to(game.gameId).emit('next dimensions', game.getNextDimensions());
  });
  socket.on('share game', (shareData) => {
    if (game == defaultGame)
      return;
    var name = shareData.name;
    var hidden = shareData.hidden;
    game.name = name;
    game.hidden = hidden;
    io.to(game.gameId).emit('share game', {
      name: game.name,
      hidden: game.hidden,
      isDefaultGame: game == defaultGame
    });
  });

  socket.on('mouse in', (coord) => {});
  socket.on('mouse out', (coord) => {});
});

app.set('view engine', 'pug');

app.get('/', (req, res) => {
  res.render('index');
});
app.get('/games', (req, res) => {
  res.render('games', {
    Games: Games
  });
});
app.get('/new', (req, res) => {
  console.log('/new');
  var game = Games.createGame();
  logger.debug(`Game ${game.gameId} created in response to ${req.connection.remoteAddress}`);
  res.redirect(`/?g=${game.gameId}`);
});
app.get('/solo/:width/:height/:mines/', (req, res) => {
  res.render('solo');
});
app.get('/solo', (req, res) => {
  res.sendFile(__dirname + '/solo.html');
});
app.get('/client.js', (req, res) => {
  res.sendFile(__dirname + '/js/uglified.js');
});
app.get('/menu.js', (req, res) => {
  res.sendFile(__dirname + '/menu.js');
});
app.get('/js.cookie.js', (req, res) => {
  res.sendFile(__dirname + '/node_modules/js-cookie/src/js.cookie.js');
});
app.get('/socket.io.js', (req, res) => {
  res.sendFile(__dirname + '/node_modules/socket.io-client/socket.io.js');
});
app.get('/jquery.min.js', (req, res) => {
  res.sendFile(__dirname + '/node_modules/jquery/dist/jquery.min.js');
});
app.get('/favicon.png', (req, res) => {
  res.sendFile(__dirname + `/img/favicon.png`);
});
app.get('/favicon2.png', (req, res) => {
  res.sendFile(__dirname + `/img/favicon2.png`);
});
app.get('/style.css', (req, res) => {
  res.sendFile(__dirname + '/css/style.css');
});
app.get('/materialize.min.css', (req, res) => {
  res.sendFile(__dirname + '/node_modules/materialize-css/dist/css/materialize.min.css');
});
app.get('/materialize.min.js', (req, res) => {
  res.sendFile(__dirname + '/node_modules/materialize-css/dist/js/materialize.min.js');
});
app.get('/fonts/roboto/Roboto-Regular.woff2', (req, res) => {
  res.sendFile(__dirname + '/node_modules/materialize-css/dist/fonts/roboto/Roboto-Regular.woff2');
});
app.get('/fonts/roboto/Roboto-Bold.woff2', (req, res) => {
  res.sendFile(__dirname + '/node_modules/materialize-css/dist/fonts/roboto/Roboto-Bold.woff2');
});
app.get('/fonts/roboto/Roboto-Light.woff2', (req, res) => {
  res.sendFile(__dirname + '/node_modules/materialize-css/dist/fonts/roboto/Roboto-Bold.woff2');
});
http.listen(config.port, () => {
  logger.info(`Multiplayer Mines started on http://localhost:${config.port}`);
});
