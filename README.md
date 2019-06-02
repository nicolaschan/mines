# mines
Multiplayer minesweeper in your web browser. The author hosts the game at [mines.nicolaschan.com](https://mines.nicolaschan.com) (not always available).

# Features
- Multiplayer and real time updating
- Adjustable height, width, and number of mines
- First click is guaranteed to have no mines adjacent (board generated after the first click)
- Multiple "rooms" available for private games
- Flags available (of course!)

# Installation

You can edit `config.json` to adjust the port. You should also change the secret password to be something secret you make up (it is used to verify the integrity of usernames to prevent users from using arbitrary usernames).

It will be running on [http://localhost:8080](http://localhost:8080) by default.

## With node and npm
```bash
git clone https://github.com/nicolaschan/mines.git
cd mines
npm install
npm start
```

## With Docker
```bash
git clone https://github.com/nicolaschan/mines.git
cd mines
docker build -t mines .
docker run -d -p 8080:8080 mines
```

# Screenshots

![completed game](https://i.imgur.com/UwoO1sY.png)
![in progress game](https://i.imgur.com/iF2rXpe.png)
![win](https://i.imgur.com/t1d1rcW.png)
![lose](https://i.imgur.com/YGL3uE7.png)
