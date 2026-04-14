const socket = io();

// DOM элементы
const screens = {
  lobby: document.getElementById('lobbyScreen'),
  room: document.getElementById('roomScreen'),
  game: document.getElementById('gameScreen')
};

const elements = {
  newRoundBtn: document.getElementById('newRoundBtn'),
  playerNameInput: document.getElementById('playerNameInput'),
  createRoomBtn: document.getElementById('createRoomBtn'),
  roomIdInput: document.getElementById('roomIdInput'),
  joinRoomBtn: document.getElementById('joinRoomBtn'),
  errorMessage: document.getElementById('errorMessage'),
  
  roomIdDisplay: document.getElementById('roomIdDisplay'),
  playerCount: document.getElementById('playerCount'),
  playersList: document.getElementById('playersList'),
  startGameBtn: document.getElementById('startGameBtn'),
  gameStatusMessage: document.getElementById('gameStatusMessage'),
  leaveRoomBtn: document.getElementById('leaveRoomBtn'),
  
  cardRole: document.getElementById('cardRole'),
  cardCharacter: document.getElementById('cardCharacter'),
  backToLobbyBtn: document.getElementById('backToLobbyBtn')
};

// Состояние клиента
let currentRoomId = null;
let isHost = false;
let gameStarted = false;

// Вспомогательные функции
function showScreen(screenName) {
  Object.keys(screens).forEach(key => {
    screens[key].classList.remove('active');
  });
  screens[screenName].classList.add('active');
}

function showError(message) {
  elements.errorMessage.textContent = message;
  setTimeout(() => {
    elements.errorMessage.textContent = '';
  }, 3000);
}

function updatePlayersList(players) {
  elements.playerCount.textContent = players.length;
  const listHtml = players.map(player => {
    const isHostBadge = player.isHost ? '<span class="player-host-badge">👑</span>' : '';
    const isYouBadge = player.id === socket.id ? '<span class="player-you-badge">(вы)</span>' : '';
    return `<li>${player.name} ${isHostBadge} ${isYouBadge}</li>`;
  }).join('');
  elements.playersList.innerHTML = listHtml;
  
  // Обновить доступность кнопки старта (только для хоста и если игроков >=2)
  if (isHost && !gameStarted) {
    elements.startGameBtn.disabled = players.length < 2;
  } else {
    elements.startGameBtn.disabled = true;
  }
}

function resetUI() {
  currentRoomId = null;
  isHost = false;
  gameStarted = false;
  elements.startGameBtn.disabled = true;
  elements.gameStatusMessage.textContent = '';
}

// Обработчики событий Socket
socket.on('connect', () => {
  console.log('Connected to server with id:', socket.id);
});

socket.on('error', (data) => {
  showError(data.message);
});

// Создание комнаты
socket.on('roomCreated', (data) => {
  currentRoomId = data.roomId;
  isHost = data.isHost;
  gameStarted = false;
  
  elements.roomIdDisplay.textContent = currentRoomId;
  updatePlayersList(data.players);
  showScreen('room');
});

// Присоединение к комнате (для присоединившегося)
socket.on('joinedRoom', (data) => {
  currentRoomId = data.roomId;
  isHost = data.isHost;
  gameStarted = false;
  
  elements.roomIdDisplay.textContent = currentRoomId;
  updatePlayersList(data.players);
  showScreen('room');
});

// Когда другой игрок присоединяется
socket.on('playerJoined', (data) => {
  updatePlayersList(data.players);
  elements.gameStatusMessage.textContent = `Игрок ${data.player.name} присоединился`;
  setTimeout(() => { elements.gameStatusMessage.textContent = ''; }, 2000);
});

// Когда игрок покидает комнату
socket.on('playerLeft', (data) => {
  updatePlayersList(data.players);
  elements.gameStatusMessage.textContent = `Игрок покинул комнату`;
  setTimeout(() => { elements.gameStatusMessage.textContent = ''; }, 2000);
});

// Начало игры
socket.on('gameStarted', (data) => {
  gameStarted = true;
  elements.cardRole.textContent = data.role === 'imposter' ? 'ИМПОСТЕР' : 'ПЕРСОНАЖ';
  elements.cardCharacter.textContent = data.character;

  if (isHost) {
    elements.newRoundBtn.style.display = 'block';
  } else {
    elements.newRoundBtn.style.display = 'none';
  }

  showScreen('game');
});

socket.on('gameStatus', (data) => {
  if (data.started) {
    gameStarted = true;
    elements.startGameBtn.disabled = true;
    elements.gameStatusMessage.textContent = 'Игра началась!';
  }
});

// Покинуть комнату (подтверждение от сервера)
socket.on('leftRoom', () => {
  resetUI();
  showScreen('lobby');
});

// Обработчики кнопок
elements.createRoomBtn.addEventListener('click', () => {
  const playerName = elements.playerNameInput.value.trim();
  if (!playerName) {
    showError('Введи имя');
    return;
  }
  socket.emit('createRoom', { playerName });
});
elements.newRoundBtn.addEventListener('click', () => {
  socket.emit('resetGame');
});
socket.on('gameReset', (data) => {
  gameStarted = false;
  elements.newRoundBtn.style.display = 'none';
  updatePlayersList(data.players);
  showScreen('room');
});
elements.joinRoomBtn.addEventListener('click', () => {
  const playerName = elements.playerNameInput.value.trim();
  const roomId = elements.roomIdInput.value.trim().toUpperCase();
  if (!playerName || !roomId) {
    showError('Введи имя и код комнаты');
    return;
  }
  socket.emit('joinRoom', { roomId, playerName });
});

elements.startGameBtn.addEventListener('click', () => {
  if (!isHost) return;
  socket.emit('startGame');
});

elements.leaveRoomBtn.addEventListener('click', () => {
  socket.emit('leaveRoom');
});

elements.backToLobbyBtn.addEventListener('click', () => {
  socket.emit('leaveRoom');
  elements.newRoundBtn.style.display = 'none';
  setTimeout(() => {
    resetUI();
    showScreen('lobby');
  }, 100);
});


// Обработка отключения от сервера (переподключение)
socket.on('disconnect', () => {
  showError('Соединение с сервером потеряно');
  resetUI();
  showScreen('lobby');
});