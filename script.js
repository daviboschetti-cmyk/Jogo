// script.js — Tetris Multiplayer (baseado no Tetris single-player original)

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO DO CANVAS PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

const canvas = document.getElementById("game");
const context = canvas.getContext("2d");

const grid = 32;        // Tamanho de cada célula no canvas principal
const COLUNAS = 10;     // Número de colunas do campo
const LINHAS = 20;      // Número de linhas do campo

// ═══════════════════════════════════════════════════════════════════
// ELEMENTOS DA INTERFACE
// ═══════════════════════════════════════════════════════════════════

const scoreElement   = document.getElementById("score");
const linesElement   = document.getElementById("lines");
const restartButton  = document.getElementById("restart");

// Lobby
const telaLobby        = document.getElementById("tela-lobby");
const telaJogo         = document.getElementById("tela-jogo");
const campoNome        = document.getElementById("campo-nome");
const campoCodigoSala  = document.getElementById("campo-codigo-sala");
const btnCriarSala     = document.getElementById("btn-criar-sala");
const btnEntrarSala    = document.getElementById("btn-entrar-sala");
const lobbyMensagem    = document.getElementById("lobby-mensagem");
const areaEspera       = document.getElementById("area-espera");
const exibirCodigoSala = document.getElementById("exibir-codigo-sala");
const listaJogadores   = document.getElementById("lista-jogadores");

// Jogo
const jogoCodigoSala   = document.getElementById("jogo-codigo-sala");
const jogoNomeJogador  = document.getElementById("jogo-nome-jogador");
const painelAdversarios = document.getElementById("painel-adversarios");
const overlayResultado  = document.getElementById("overlay-resultado");
const resultadoTitulo   = document.getElementById("resultado-titulo");
const resultadoMensagem = document.getElementById("resultado-mensagem");
const btnResultadoReiniciar = document.getElementById("btn-resultado-reiniciar");

// ═══════════════════════════════════════════════════════════════════
// CORES DAS PEÇAS
// ═══════════════════════════════════════════════════════════════════

const cores = {
  I: "#00e5ff",
  O: "#ffeb3b",
  T: "#b388ff",
  S: "#4caf50",
  Z: "#f44336",
  J: "#2196f3",
  L: "#ff9800",
  P: "#607d8b"   // Cor das linhas de penalidade
};

// Alias para compatibilidade com o código original
const colors = cores;

// ═══════════════════════════════════════════════════════════════════
// MATRIZES DAS PEÇAS (tetrominos)
// ═══════════════════════════════════════════════════════════════════

const tetrominos = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],

  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],

  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0]
  ],

  O: [
    [1, 1],
    [1, 1]
  ],

  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0]
  ],

  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0]
  ],

  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ]
};

// ═══════════════════════════════════════════════════════════════════
// ESTADO DO JOGO
// ═══════════════════════════════════════════════════════════════════

let playfield;
let sequenciaTetrominos;
let tetromino;
let score;
let lines;
let count;
let gameOver;
let lastTime;
let dropInterval;
let animationId;

// ═══════════════════════════════════════════════════════════════════
// GERADOR DE NÚMEROS PSEUDOALEATÓRIOS (PRNG) — Linear Congruential Generator
// Baseado em semente compartilhada, garante mesma sequência de peças para todos
// ═══════════════════════════════════════════════════════════════════

let rng = Math.random; // Padrão; substituído pela função com semente ao iniciar partida

// Cria um PRNG com semente determinística
function criarRNG(semente) {
  let s = semente;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ═══════════════════════════════════════════════════════════════════
// GERAÇÃO DE SEQUÊNCIA DE PEÇAS
// Usa o PRNG com semente para garantir sequência idêntica entre jogadores
// ═══════════════════════════════════════════════════════════════════

// Gera uma sequência com todas as sete peças (embaralhadas com o PRNG)
function generateSequence() {
  const sequence = ["I", "J", "L", "O", "S", "T", "Z"];

  for (let i = sequence.length - 1; i > 0; i--) {
    const indiceAleatorio = Math.floor(rng() * (i + 1));
    [sequence[i], sequence[indiceAleatorio]] = [sequence[indiceAleatorio], sequence[i]];
  }

  return sequence;
}

// Obtém a próxima peça da sequência
function getNextTetromino() {
  if (sequenciaTetrominos.length === 0) {
    sequenciaTetrominos = generateSequence();
  }

  const nome = sequenciaTetrominos.pop();
  const matrix = tetrominos[nome].map(linha => [...linha]);

  return {
    name: nome,
    matrix: matrix,
    row: nome === "I" ? -1 : -2,
    col: Math.floor(COLUNAS / 2) - Math.ceil(matrix[0].length / 2)
  };
}

// ═══════════════════════════════════════════════════════════════════
// LÓGICA DO JOGO (preservada do original)
// ═══════════════════════════════════════════════════════════════════

// Gira uma matriz em 90 graus
function rotate(matrix) {
  const N = matrix.length - 1;
  return matrix.map((row, i) => row.map((value, j) => matrix[N - j][i]));
}

// Verifica limites e colisões
function isValidMove(matrix, cellRow, cellCol) {
  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (!matrix[row][col]) continue;

      const novaLinha  = cellRow + row;
      const novaColuna = cellCol + col;

      if (novaColuna < 0 || novaColuna >= COLUNAS || novaLinha >= LINHAS) {
        return false;
      }

      // As peças podem começar acima da tela
      if (novaLinha >= 0 && playfield[novaLinha][novaColuna]) {
        return false;
      }
    }
  }

  return true;
}

// Cria uma nova peça
function spawnTetromino() {
  tetromino = getNextTetromino();

  if (!isValidMove(tetromino.matrix, tetromino.row, tetromino.col)) {
    gameOver = true;
  }
}

// Fixa a peça e limpa linhas completas
function placeTetromino() {
  for (let row = 0; row < tetromino.matrix.length; row++) {
    for (let col = 0; col < tetromino.matrix[row].length; col++) {
      if (!tetromino.matrix[row][col]) continue;

      const linhaBoard  = tetromino.row + row;
      const colunaBoard = tetromino.col + col;

      if (linhaBoard < 0) {
        gameOver = true;
        return;
      }

      playfield[linhaBoard][colunaBoard] = tetromino.name;
    }
  }

  clearLines();

  if (!gameOver) {
    spawnTetromino();
  }
}

// Remove linhas completas e aplica pontuação
function clearLines() {
  let cleared = 0;

  for (let row = LINHAS - 1; row >= 0; row--) {
    if (playfield[row].every(celula => celula !== 0)) {
      playfield.splice(row, 1);
      playfield.unshift(Array(COLUNAS).fill(0));
      cleared++;
      row++;
    }
  }

  if (cleared > 0) {
    const pontos = [0, 100, 300, 500, 800];
    score += pontos[cleared] || cleared * 200;
    lines += cleared;

    scoreElement.textContent = score;
    linesElement.textContent = lines;

    // Envia linhas de penalidade ao(s) adversário(s) se limpou mais de 1 linha
    if (cleared > 1) {
      socket.emit("linhasPenalidade", cleared - 1);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// PENALIDADE — Insere linhas na parte inferior do campo
// ═══════════════════════════════════════════════════════════════════

// Recebe linhas de penalidade enviadas por adversário(s)
function receberLinhasPenalidade(quantidade) {
  if (gameOver) return;

  // Remove as primeiras `quantidade` linhas do topo para compensar
  playfield.splice(0, quantidade);

  // Insere `quantidade` linhas de penalidade na parte inferior
  for (let i = 0; i < quantidade; i++) {
    // Escolhe uma coluna aleatória para o "buraco"
    const buraco = Math.floor(rng() * COLUNAS);
    const linhaPenalidade = Array.from({ length: COLUNAS }, (_, col) =>
      col === buraco ? 0 : "P"
    );
    playfield.push(linhaPenalidade);
  }
}

// ═══════════════════════════════════════════════════════════════════
// RENDERIZAÇÃO — Canvas principal
// ═══════════════════════════════════════════════════════════════════

// Desenha uma matriz no canvas principal
function drawMatrix(matrix, offsetRow, offsetCol, cor) {
  context.fillStyle = cor;

  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (matrix[row][col]) {
        const x = (offsetCol + col) * grid;
        const y = (offsetRow + row) * grid;

        if (y >= 0) {
          context.fillRect(x, y, grid - 1, grid - 1);
        }
      }
    }
  }
}

// Desenha o campo de jogo e a peça atual no canvas principal
function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Desenha as peças fixas
  for (let row = 0; row < LINHAS; row++) {
    for (let col = 0; col < COLUNAS; col++) {
      const nome = playfield[row][col];
      if (nome) {
        drawMatrix([[1]], row, col, cores[nome]);
      }
    }
  }

  // Desenha a peça em movimento
  if (tetromino) {
    drawMatrix(
      tetromino.matrix,
      tetromino.row,
      tetromino.col,
      cores[tetromino.name]
    );
  }

  // Tela de fim de jogo
  if (gameOver) {
    context.fillStyle = "rgba(0, 0, 0, 0.8)";
    context.fillRect(0, canvas.height / 2 - 50, canvas.width, 100);

    context.fillStyle = "#ff5252";
    context.font = "bold 28px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("FIM DE JOGO!", canvas.width / 2, canvas.height / 2);
  }
}

// ═══════════════════════════════════════════════════════════════════
// RENDERIZAÇÃO — Canvas dos adversários
// ═══════════════════════════════════════════════════════════════════

const gridAdversario = 16; // Metade do grid original (escala 0.5x)

// Desenha o campo de um adversário em um canvas pequeno (160x320)
function desenharCampoAdversario(ctx, playfieldAdv, tetrominoAdv) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Desenha as peças fixas
  for (let row = 0; row < LINHAS; row++) {
    for (let col = 0; col < COLUNAS; col++) {
      const nome = playfieldAdv[row][col];
      if (nome) {
        ctx.fillStyle = cores[nome];
        ctx.fillRect(
          col * gridAdversario,
          row * gridAdversario,
          gridAdversario - 1,
          gridAdversario - 1
        );
      }
    }
  }

  // Desenha a peça em movimento do adversário
  if (tetrominoAdv) {
    ctx.fillStyle = cores[tetrominoAdv.name] || "#ffffff";
    for (let row = 0; row < tetrominoAdv.matrix.length; row++) {
      for (let col = 0; col < tetrominoAdv.matrix[row].length; col++) {
        if (tetrominoAdv.matrix[row][col]) {
          const y = (tetrominoAdv.row + row) * gridAdversario;
          const x = (tetrominoAdv.col + col) * gridAdversario;
          if (y >= 0) {
            ctx.fillRect(x, y, gridAdversario - 1, gridAdversario - 1);
          }
        }
      }
    }
  }
}

// Mapa de canvas dos adversários: { socketId → { canvasEl, ctx, nomeEl } }
const canvasAdversarios = {};

// Cria ou obtém o canvas de um adversário
function obterCanvasAdversario(id, nome) {
  if (canvasAdversarios[id]) return canvasAdversarios[id];

  // Wrapper
  const wrapper = document.createElement("div");
  wrapper.classList.add("adversario-wrapper");
  wrapper.id = `adversario-${id}`;

  // Nome
  const nomeEl = document.createElement("div");
  nomeEl.classList.add("adversario-nome");
  nomeEl.textContent = nome || "Adversário";

  // Canvas
  const canvasEl = document.createElement("canvas");
  canvasEl.width  = 160;
  canvasEl.height = 320;
  canvasEl.classList.add("canvas-adversario");

  wrapper.appendChild(nomeEl);
  wrapper.appendChild(canvasEl);
  painelAdversarios.appendChild(wrapper);

  const ctx = canvasEl.getContext("2d");

  canvasAdversarios[id] = { canvasEl, ctx, nomeEl, wrapper };
  return canvasAdversarios[id];
}

// Remove o canvas de um adversário da tela
function removerCanvasAdversario(id) {
  const adv = canvasAdversarios[id];
  if (adv) {
    adv.wrapper.remove();
    delete canvasAdversarios[id];
  }
}

// Remove todos os canvas de adversários
function limparCanvasAdversarios() {
  Object.keys(canvasAdversarios).forEach(id => removerCanvasAdversario(id));
}

// ═══════════════════════════════════════════════════════════════════
// LOOP PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

// Flag para evitar emitir "jogadorEliminado" mais de uma vez por partida
let eliminadoEmitido = false;

function loop(timestamp = 0) {
  if (gameOver) {
    draw();

    // Notifica o servidor que este jogador foi eliminado (apenas uma vez)
    if (!eliminadoEmitido) {
      eliminadoEmitido = true;
      socket.emit("jogadorEliminado");
    }
    return;
  }

  if (!lastTime) lastTime = timestamp;

  const delta = timestamp - lastTime;
  lastTime = timestamp;
  count += delta;

  if (count >= dropInterval) {
    tetromino.row++;
    count = 0;

    if (!isValidMove(tetromino.matrix, tetromino.row, tetromino.col)) {
      tetromino.row--;
      placeTetromino();
    }
  }

  draw();

  // Emite o estado atual ao servidor para sincronização com adversários
  // Inclui o nome do jogador para exibição no painel do adversário
  socket.emit("estadoJogador", {
    playfield: playfield,
    tetromino: tetromino,
    nome: nomeJogador
  });

  if (!gameOver) {
    animationId = requestAnimationFrame(loop);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONTROLES DO TECLADO
// ═══════════════════════════════════════════════════════════════════

document.addEventListener("keydown", function (evento) {
  if (gameOver) return;

  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(evento.key)) {
    evento.preventDefault();
  }

  if (evento.key === "ArrowLeft") {
    if (isValidMove(tetromino.matrix, tetromino.row, tetromino.col - 1)) {
      tetromino.col--;
    }
  }

  if (evento.key === "ArrowRight") {
    if (isValidMove(tetromino.matrix, tetromino.row, tetromino.col + 1)) {
      tetromino.col++;
    }
  }

  if (evento.key === "ArrowUp") {
    const rotacionada = rotate(tetromino.matrix);
    if (isValidMove(rotacionada, tetromino.row, tetromino.col)) {
      tetromino.matrix = rotacionada;
    }
  }

  if (evento.key === "ArrowDown") {
    if (isValidMove(tetromino.matrix, tetromino.row + 1, tetromino.col)) {
      tetromino.row++;
      score += 1;
      scoreElement.textContent = score;
    } else {
      placeTetromino();
    }
    count = 0;
  }

  // Queda instantânea com a barra de espaço
  if (evento.key === " ") {
    while (isValidMove(tetromino.matrix, tetromino.row + 1, tetromino.col)) {
      tetromino.row++;
      score += 2;
    }
    scoreElement.textContent = score;
    placeTetromino();
    count = 0;
  }

  draw();
});

// ═══════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO DO JOGO
// ═══════════════════════════════════════════════════════════════════

// Inicia ou reinicia o jogo com a semente fornecida
function startGame(semente) {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  // Reseta a flag de eliminação para a nova partida
  eliminadoEmitido = false;

  // Inicializa o PRNG com a semente compartilhada
  rng = criarRNG(semente);

  playfield = Array.from({ length: LINHAS }, () => Array(COLUNAS).fill(0));

  sequenciaTetrominos = [];
  tetromino = null;
  score = 0;
  lines = 0;
  count = 0;
  gameOver = false;
  lastTime = 0;
  dropInterval = 500;

  scoreElement.textContent = score;
  linesElement.textContent = lines;

  // Oculta overlay de resultado
  overlayResultado.style.display = "none";

  spawnTetromino();
  draw();

  animationId = requestAnimationFrame(loop);
}

// ═══════════════════════════════════════════════════════════════════
// SOCKET.IO — Conexão e eventos multiplayer
// ═══════════════════════════════════════════════════════════════════

const socket = io();

// Estado do lobby
let nomeJogador = "";
let codigoSalaAtual = "";

// ───────────────────────────────────────────────────────────────────
// Exibe uma mensagem de feedback no lobby
// ───────────────────────────────────────────────────────────────────
function exibirMensagemLobby(mensagem, tipo = "info") {
  lobbyMensagem.textContent = mensagem;
  lobbyMensagem.className = `lobby-mensagem lobby-mensagem-${tipo}`;
}

// ───────────────────────────────────────────────────────────────────
// Atualiza a lista de jogadores no lobby
// ───────────────────────────────────────────────────────────────────
function atualizarListaJogadores(jogadores) {
  listaJogadores.innerHTML = "";
  jogadores.forEach(nome => {
    const li = document.createElement("li");
    li.textContent = nome;
    listaJogadores.appendChild(li);
  });
}

// ───────────────────────────────────────────────────────────────────
// Transição: lobby → tela de jogo
// ───────────────────────────────────────────────────────────────────
function entrarNaTelaDeJogo() {
  telaLobby.style.display = "none";
  telaJogo.style.display  = "block";
  jogoCodigoSala.textContent  = codigoSalaAtual;
  jogoNomeJogador.textContent = nomeJogador;
}

// ───────────────────────────────────────────────────────────────────
// Exibe overlay de resultado ao final da partida
// ───────────────────────────────────────────────────────────────────
function exibirResultado(nomeVencedor) {
  overlayResultado.style.display = "flex";

  if (!nomeVencedor) {
    // Empate (todos eliminados)
    resultadoTitulo.textContent   = "🤝 EMPATE!";
    resultadoTitulo.className     = "resultado-titulo empate";
    resultadoMensagem.textContent = "Todos foram eliminados ao mesmo tempo!";
  } else if (nomeVencedor === nomeJogador) {
    resultadoTitulo.textContent   = "🏆 VOCÊ VENCEU!";
    resultadoTitulo.className     = "resultado-titulo vitoria";
    resultadoMensagem.textContent = "Parabéns! Você é o último sobrevivente!";
  } else {
    resultadoTitulo.textContent   = "💀 VOCÊ PERDEU!";
    resultadoTitulo.className     = "resultado-titulo derrota";
    resultadoMensagem.textContent = `${nomeVencedor} venceu esta rodada.`;
  }
}

// ───────────────────────────────────────────────────────────────────
// Evento: botão "Criar Sala"
// ───────────────────────────────────────────────────────────────────
btnCriarSala.addEventListener("click", () => {
  const nome = campoNome.value.trim();
  if (!nome) {
    exibirMensagemLobby("Por favor, informe seu nome antes de criar uma sala.", "erro");
    return;
  }
  nomeJogador = nome;
  socket.emit("criarSala", { nome });
  exibirMensagemLobby("Criando sala...", "info");
});

// ───────────────────────────────────────────────────────────────────
// Evento: botão "Entrar na Sala"
// ───────────────────────────────────────────────────────────────────
btnEntrarSala.addEventListener("click", () => {
  const nome   = campoNome.value.trim();
  const codigo = campoCodigoSala.value.trim().toUpperCase();

  if (!nome) {
    exibirMensagemLobby("Por favor, informe seu nome.", "erro");
    return;
  }
  if (codigo.length !== 4) {
    exibirMensagemLobby("O código da sala deve ter 4 letras.", "erro");
    return;
  }

  nomeJogador = nome;
  socket.emit("entrarSala", { codigoSala: codigo, nome });
  exibirMensagemLobby("Entrando na sala...", "info");
});

// ───────────────────────────────────────────────────────────────────
// Resposta: salaCriada
// ───────────────────────────────────────────────────────────────────
socket.on("salaCriada", ({ codigoSala, jogadores }) => {
  codigoSalaAtual = codigoSala;
  exibirCodigoSala.textContent = codigoSala;
  atualizarListaJogadores(jogadores);
  areaEspera.style.display = "block";
  exibirMensagemLobby(`Sala criada! Compartilhe o código: ${codigoSala}`, "sucesso");
});

// ───────────────────────────────────────────────────────────────────
// Resposta: entrarSalaResposta
// ───────────────────────────────────────────────────────────────────
socket.on("entrarSalaResposta", ({ sucesso, jogadores, erro }) => {
  if (!sucesso) {
    exibirMensagemLobby(erro || "Não foi possível entrar na sala.", "erro");
    return;
  }

  // Atualiza código e lista caso ainda esteja no lobby
  if (!codigoSalaAtual) {
    codigoSalaAtual = campoCodigoSala.value.trim().toUpperCase();
  }
  exibirCodigoSala.textContent = codigoSalaAtual;
  atualizarListaJogadores(jogadores);
  areaEspera.style.display = "block";
  exibirMensagemLobby("Entrou na sala! Aguardando início...", "sucesso");
});

// ───────────────────────────────────────────────────────────────────
// Evento: iniciarPartida
// Recebe a semente e começa o jogo
// ───────────────────────────────────────────────────────────────────
socket.on("iniciarPartida", ({ sementeSequencia }) => {
  entrarNaTelaDeJogo();
  limparCanvasAdversarios();
  startGame(sementeSequencia);
});

// ───────────────────────────────────────────────────────────────────
// Evento: estadoAdversario
// Renderiza o campo do adversário no canvas pequeno
// ───────────────────────────────────────────────────────────────────
socket.on("estadoAdversario", ({ id, playfield: playfieldAdv, tetromino: tetrominoAdv, nome: nomeAdv }) => {
  // Obtém ou cria o canvas do adversário; usa o nome recebido (ou trecho do ID como fallback)
  const adv = obterCanvasAdversario(id, nomeAdv || id.substring(0, 6));

  // Atualiza o nome exibido caso tenha chegado agora
  if (nomeAdv && adv.nomeEl.textContent !== nomeAdv) {
    adv.nomeEl.textContent = nomeAdv;
  }

  desenharCampoAdversario(adv.ctx, playfieldAdv, tetrominoAdv);
});

// ───────────────────────────────────────────────────────────────────
// Evento: receberPenalidade
// Adiciona linhas de penalidade ao campo do jogador local
// ───────────────────────────────────────────────────────────────────
socket.on("receberPenalidade", (quantidade) => {
  receberLinhasPenalidade(quantidade);
});

// ───────────────────────────────────────────────────────────────────
// Evento: vencedor
// Exibe o resultado da partida
// ───────────────────────────────────────────────────────────────────
socket.on("vencedor", (nomeVencedor) => {
  // Para o loop de animação
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  exibirResultado(nomeVencedor);
});

// ───────────────────────────────────────────────────────────────────
// Evento: jogadorSaiu
// Remove o canvas do adversário que desconectou
// ───────────────────────────────────────────────────────────────────
socket.on("jogadorSaiu", ({ id, nome }) => {
  removerCanvasAdversario(id);
  console.log(`[Sala] Jogador ${nome} saiu da partida.`);
});

// ───────────────────────────────────────────────────────────────────
// Evento: salaReiniciada
// Reinicia o jogo com nova semente
// ───────────────────────────────────────────────────────────────────
socket.on("salaReiniciada", ({ sementeSequencia }) => {
  limparCanvasAdversarios();
  startGame(sementeSequencia);
});

// ───────────────────────────────────────────────────────────────────
// Evento: aguardandoJogadores
// Exibe mensagem caso não haja jogadores suficientes para reiniciar
// ───────────────────────────────────────────────────────────────────
socket.on("aguardandoJogadores", () => {
  alert("Aguardando mais jogadores para reiniciar.");
});

// ───────────────────────────────────────────────────────────────────
// Botão "Reiniciar sala" — solicita reinício para todos
// ───────────────────────────────────────────────────────────────────
restartButton.addEventListener("click", () => {
  socket.emit("reiniciarSala");
});

// ───────────────────────────────────────────────────────────────────
// Botão de reinício no overlay de resultado
// ───────────────────────────────────────────────────────────────────
btnResultadoReiniciar.addEventListener("click", () => {
  socket.emit("reiniciarSala");
});
