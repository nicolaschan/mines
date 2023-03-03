'use strict';

const chalk = require('chalk');
const shuffleSeed = require('shuffle-seed');
const shortid = require('shortid');
const clone = require('clone');
const Base64 = require('js-base64').Base64;
const log4js = require('log4js');

/**
 * Creates a mines board with specified params.
 * 
 * @constructor
 * @param {number} width  Width of the board
 * @param {number} height Height of the board
 * @param {number} mines  Number of mines on the board
 */
const Board = function(width, height, mines, id) {
	this.width = width;
	this.height = height;
	this.mines = mines;
	this.seed = (id) ? id : shortid.generate();
	this.generated = false;
	this.lost = false;
	this.won = false;
	this.squares = [];
	this.reveals = [];
	this.numberOfHiddenSafeSquares = 0;
	this.startTime;
	this.endTime;
	this.flagCount = 0;

	this.logger = log4js.getLogger(`Board ${this.seed}`);
	this.logger.debug('Created!');

	for (let x = 0; x < width; x++) {
		this.squares[x] = [];
		for (let y = 0; y < height; y++)
			this.squares[x][y] = {
				x: x,
				y: y,
				revealed: false,
				flagged: false
			};
	}
};

Board.prototype.getDimensions = function() {
	return {
		width: this.width,
		height: this.height,
		mines: this.mines
	};
};

/**
 * Fills the board with mines.
 * @param  {number} x x-coordinate of the first click
 * @param  {number} y y-coordinate of the first click
 */
Board.prototype.generate = function(x, y) {
	this.initialX = x;
	this.initialY = y;

	// mark reserved squares
	this.squares[x][y].reserved = true;
	var numberOfReservedSquares = 0;
	var adjacentSquares = this.getAdjacentSquares(x, y);
	for (let i in adjacentSquares) {
		adjacentSquares[i].reserved = true;
		numberOfReservedSquares++;
	}

	// distribute mines
	var minesToPlace = this.mines;
	var randomMines = [];
	this.numberOfHiddenSafeSquares += numberOfReservedSquares + 1;
	for (let i = 0; i < this.width * this.height - numberOfReservedSquares - 1; i++) {
		if (minesToPlace > 0) {
			randomMines.push(true);
			minesToPlace--;
		} else {
			this.numberOfHiddenSafeSquares++;
			randomMines.push(false);
		}
	}
	randomMines = shuffleSeed.shuffle(randomMines, this.seed);

	var currentIndexInRandomMines = 0;
	for (let x in this.squares) {
		for (let y in this.squares[x]) {
			if (!this.squares[x][y].reserved) {
				this.squares[x][y].mine = randomMines[currentIndexInRandomMines];
				currentIndexInRandomMines++;
			} else {
				this.squares[x][y].mine = false;
			}
		}
	}

	// add counts to squares
	for (let x in this.squares) {
		for (let y in this.squares[x]) {
			this.squares[x][y].count = this.mineCount(parseInt(x), parseInt(y));
		}
	}

	this.generated = true;
	this.startTime = Date.now();

	this.logger.debug(`Start serialization: ${this.serializeStart()}`);
};

/**
 * Returns adjacent squares to the one indicated.
 * @param  {number} x x-coordinate of the square
 * @param  {number} y y-coordinate of the square
 * @return {Array<Object>}   array of adjacent squares
 */
Board.prototype.getAdjacentSquares = function(x, y) {
	var adjacentSquares = [];

	// Squares to the left
	if (this.squares[x - 1]) {
		if (this.squares[x - 1][y - 1])
			adjacentSquares.push(this.squares[x - 1][y - 1]);
		if (this.squares[x - 1][y])
			adjacentSquares.push(this.squares[x - 1][y]);
		if (this.squares[x - 1][y + 1])
			adjacentSquares.push(this.squares[x - 1][y + 1]);
	}

	// Square above and below
	if (this.squares[x][y - 1])
		adjacentSquares.push(this.squares[x][y - 1]);
	if (this.squares[x][y + 1])
		adjacentSquares.push(this.squares[x][y + 1]);

	// Squares to the right
	if (this.squares[x + 1]) {
		if (this.squares[x + 1][y - 1])
			adjacentSquares.push(this.squares[x + 1][y - 1]);
		if (this.squares[x + 1][y])
			adjacentSquares.push(this.squares[x + 1][y]);
		if (this.squares[x + 1][y + 1])
			adjacentSquares.push(this.squares[x + 1][y + 1]);
	}

	return adjacentSquares;
};

/**
 * Get the squares that were revealed by the specified player.
 * @param  {string} username the username of the player
 * @return {Array<Object>}          array of squares
 */
Board.prototype.getSquaresByPlayer = function(username) {
	var squares = [];

	for (let x in this.squares)
		for (let y in this.squares[x])
			if (this.squares[x][y].revealedBy == username)
				squares.push(this.squares[x][y]);

	return squares;
};

/**
 * Counts the number of mines adjacent to the specified square.
 * @param  {number} x x-coordinate of the square
 * @param  {number} y y-coordinate of the square
 * @return {number}   number of mines adjacent to the square
 */
Board.prototype.mineCount = function(x, y) {
	var count = 0;

	var adjacentSquares = this.getAdjacentSquares(x, y);

	for (let i in adjacentSquares) {
		if (adjacentSquares[i].mine)
			count++;
	}

	return count;
};

/**
 * Generates the board if not already generated based on the
 * 	first click. Then reveals the clicked square and all
 * 	adjacent squares if the clicked square was a 0. All
 * 	0 squares are further revealed.
 * @param  {number} x x-coordinate of the square to reveal
 * @param  {number} y y-coordinate of the square to reveal
 * @param {string} [username] username of the person that revealed the square
 * @return {Array<Object>}   Array of squares that have been changed
 */
Board.prototype.reveal = function(x, y, username) {
	if (!this.squares[x] || !this.squares[x][y])
		return [];

	if (!this.generated) {
		this.generate(x, y);
		username = 'default';
	}

	if (this.squares[x][y].revealed)
		return [];

	this.squares[x][y].revealed = true;
	this.squares[x][y].revealedBy = username;

	this.reveals.push({
		x: x,
		y: y
	});

	// lose detection
	if (this.squares[x][y].mine)
		this.lost = true;
	else
		this.numberOfHiddenSafeSquares--;

	// check if was a flag
	if (this.squares[x][y].flagged)
		this.flagCount--;

	// win detection
	if (this.numberOfHiddenSafeSquares == 0) {
		this.won = true;
		this.endTime = Date.now();
	}

	var changedSquares = [this.squares[x][y]];

	if (this.squares[x][y].count === 0 && !this.squares[x][y].mine) {
		var adjacentSquares = this.getAdjacentSquares(x, y);
		for (let i in adjacentSquares)
			changedSquares = changedSquares.concat(this.reveal(adjacentSquares[i].x, adjacentSquares[i].y, username));
	}

	return changedSquares;
};

Board.prototype.toggleFlag = function(x, y) {
	if (this.squares[x][y].revealed)
		return;
	if (this.squares[x][y].flagged)
		this.unflag(x, y);
	else
		this.flag(x, y);
	return this.squares[x][y];
};

Board.prototype.unflag = function(x, y) {
	this.squares[x][y].flagged = false;
	this.flagCount--;
};

Board.prototype.flag = function(x, y) {
	this.squares[x][y].flagged = true;
	this.flagCount++;
};

/**
 * Calculates the time it took for the player(s) to
 *   finish the game.
 * @return {number} time elapsed in seconds
 */
Board.prototype.getTime = function() {
	if (!(this.startTime && this.endTime))
		return null;

	return (this.endTime - this.startTime) / 1000;
};

Board.prototype.makeSquareSafeForPlayer = function(square) {
	var squareForPlayer = clone(square);
	if (squareForPlayer && !squareForPlayer.revealed) {
		delete squareForPlayer.mine;
		delete squareForPlayer.count;
	}
	return squareForPlayer;
};

/**
 * Get all the squares on the board with the data
 * that the user should not see removed from them.
 * @return {Array<Object>} array of squares
 */
Board.prototype.getSquaresForPlayer = function() {
	var squaresForPlayer = [];
	for (let x in this.squares) {
		squaresForPlayer[x] = [];
		for (let y in this.squares[x]) {
			squaresForPlayer[x][y] = this.makeSquareSafeForPlayer(this.squares[x][y]);
		}
	}
	return squaresForPlayer;
};

/**
 * Returns an array of all the squares that have not been revealed.
 * 	This is usually used when the player hits and mine in order to 
 * 	show them where the remaining mines were.
 * @return {Array<Object>} array of squares
 */
Board.prototype.getRemainingSquares = function() {
	var remainingSquares = [];
	for (let x in this.squares) {
		for (let y in this.squares[x]) {
			if (!this.squares[x][y].revealed) {
				this.squares[x][y].lose = true;
				remainingSquares.push(this.squares[x][y]);
			}
		}
	}
	return remainingSquares;
};

Board.prototype.toString = function() {
	if (!this.squares)
		return '';

	var out = '┌';
	for (let x in this.squares) {
		out += '──';
	}
	out += '─┐\n';

	for (let y in this.squares[0]) {
		out += '│ ';
		for (let x in this.squares) {
			var square = '';
			if (this.squares[x][y].mine)
				square = chalk.bold.red('x');
			else if (this.squares[x][y].count === 0)
				square = chalk.gray(this.squares[x][y].count);
			else if (this.squares[x][y].count > 0)
				square = this.squares[x][y].count;
			else
				square = chalk.gray('?');

			if (this.squares[x][y].revealed)
				out += square;
			else
				out += chalk.dim(square);

			out += ' ';
		}
		out += '│\n';
	}

	out += '└';
	for (let x in this.squares) {
		out += '──';
	}
	out += '─┘';
	return out;
};

Board.prototype.serializeStart = function() {
	return `${this.height}/${this.width}/${this.mines}/${this.seed}/${this.initialX}/${this.initialY}`;
};
Board.prototype.serialize = function() {
	var stateData = {
		height: this.height,
		width: this.width,
		mines: this.mines,
		seed: this.seed,
		initialX: this.initialX,
		initialY: this.initialY,
		reveals: this.reveals
	};
	return `${Base64.encode(JSON.stringify(stateData))}`;
};

module.exports = Board;