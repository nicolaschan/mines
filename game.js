'use strict';

const hri = require('human-readable-ids').hri;
const randomcolor = require('randomcolor');
const shortid = require('shortid');
const Board = require('./board');
const log4js = require('log4js');

const Game = function(width, height, mines, name, id) {
  if (!width)
    width = 8;
  if (!height)
    height = 8;
  if (!mines)
    mines = 10;
  if (!name)
    name = 'Unnamed game';

  this.name = name;
  this.gameId = shortid.generate();

  this.hidden = true;
  this.doNotDelete = false;
  this.resetting = false;

  this.logger = log4js.getLogger(`Game ${this.gameId}`);
  this.logger.debug('Created!');

  this.nextDimensions = {
    width: width,
    height: height,
    mines: mines
  };
  this.board = new Board(width, height, mines, id);
  this.logger.debug(`Created board with seed ${this.board.seed}`);
  this.players = {};
};

Game.prototype.addPlayer = function(username) {
  if (!username)
    username = hri.random();

  var player = {
    username: username,
    color: randomcolor(),
    points: (this.players[username]) ? this.players[username].points : 0,
    connected: true
  };
  this.players[username] = player;
  return player;
};

Game.prototype.getPlayer = function(username) {
  return this.players[username];
};

Game.prototype.getPlayers = function() {
  return this.players;
};

Game.prototype.playerDisconnected = function(username) {
  if (this.players[username])
    this.players[username].connected = false;
};

Game.prototype.hasConnectedPlayers = function() {
  for (let username in this.players)
    if (this.players[username].connected)
      return true;
  return false;
};

Game.prototype.clearPlayerPoints = function() {
  for (let username in this.players)
    this.players[username].points = 0;
};

Game.prototype.removeDisconnectedPlayers = function() {
  for (let username in this.players)
    if (!this.players[username].connected)
      delete this.players[username];
};

Game.prototype.numberOfConnectedPlayers = function() {
  var count = 0;
  for (let username in this.players)
    if (this.players[username].connected)
      count++;
  return count;
};

Game.prototype.removePlayer = function(username) {
  delete this.players[username];
};

Game.prototype.setNextDimensions = function(dimensions) {
  this.nextDimensions.width = parseInt(dimensions.width);
  this.nextDimensions.height = parseInt(dimensions.height);
  this.nextDimensions.mines = parseInt(dimensions.mines);
};

Game.prototype.getNextDimensions = function() {
  return this.nextDimensions;
};

Game.prototype.getBoard = function() {
  return this.board;
};

Game.prototype.reveal = function(x, y, username) {
  if (this.resetting)
    return [];

  var revealedSquares = this.board.reveal(x, y, username);

  if (!this.board.lost)
    for (let i in revealedSquares)
      if (revealedSquares[i].revealedBy == username)
        this.players[username].points++;

  return revealedSquares;
};

Game.prototype.toggleFlag = function(x, y) {
  if (this.resetting)
    return;
  this.board.toggleFlag(x, y);
};

Game.prototype.getWinner = function() {
  var winners = [];
  var highestScore = 0;
  for (let username in this.players) {
    if (this.players[username].points > highestScore) {
      winners = [username];
      highestScore = this.players[username].points;
    } else if (this.players[username].points == highestScore) {
      winners.push(username);
    }
  }

  var winnerString = '';
  for (let i in winners) {
    if (i == 0)
      winnerString = winners[i];
    else
      winnerString += ', ' + winners[i]
  }

  return winnerString;
};

Game.prototype.resetBoard = function() {
  this.board = new Board(this.nextDimensions.width, this.nextDimensions.height, this.nextDimensions.mines);
};

Game.prototype.unhide = function() {
  this.hidden = false;
};
Game.prototype.hide = function() {
  this.hidden = true;
};
Game.prototype.setName = function(name) {
  this.name = name;
};

module.exports = Game;