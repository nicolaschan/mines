'use strict';

const Game = require('./game');

const Games = function() {
  this.games = {};
};

Games.prototype.getGame = function(gameId) {
  return this.games[gameId];
};

Games.prototype.createGame = function(width, height, mines, name) {
  var game = new Game(width, height, mines, name);
  this.games[game.gameId] = game;
  return game;
};

Games.prototype.removeUnoccupiedGames = function() {
  for (let gameId in this.games) {
    if (!this.games[gameId].hasConnectedPlayers() && !this.games[gameId].doNotDelete)
      delete this.games[gameId];
  }
};

Games.prototype.getGames = function() {
  return this.games;
};

Games.prototype.getAvailableGames = function() {
  var available = {};
  for (let gameId in this.games) {
    if (!this.games[gameId].hidden)
      available[gameId] = this.games[gameId];
  }
  return available;
};

module.exports = new Games();