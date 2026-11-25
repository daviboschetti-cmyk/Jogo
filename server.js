// server.js — Servidor multiplayer de Tetris com Socket.IO

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const servidor = http.createServer(app);
const io = new Server(servidor);

// Serve os arquivos estáticos do diretório atual
app.use(express.static(__dirname));

// Armazenamento de salas em memória
// Estrutura: { [codigoSala]: { jogadores: Map<socketId, { nome, eliminado }>, partidaAtiva: boolean } }
const salas = {};

// Gera um código de sala aleatório de 4 letras maiúsculas
function gerarCodigoSala() {
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let codigo = "";
  for (let i = 0; i < 4; i++) {
    codigo += letras[Math.floor(Math.random() * letras.length)];
  }
  return codigo;
}

// Gera uma semente inteira positiva para o PRNG
function gerarSemente() {
  return Math.floor(Math.random() * 2147483647) + 1;
}

// Obtém lista de nomes dos jogadores de uma sala
function obterNomesJogadores(sala) {
  return Array.from(sala.jogadores.values()).map(j => j.nome);
}

io.on("connection", (socket) => {
  console.log(`[Conexão] Socket conectado: ${socket.id}`);

  // Sala atual do socket (para facilitar desconexão)
  let codigoSalaAtual = null;

  // ─────────────────────────────────────────────
  // Evento: criarSala
  // Cliente envia: { nome }
  // Servidor responde: { codigoSala, jogadores }
  // ─────────────────────────────────────────────
  socket.on("criarSala", ({ nome }) => {
    // Garante código único
    let codigo;
    do {
      codigo = gerarCodigoSala();
    } while (salas[codigo]);

    // Cria a sala
    salas[codigo] = {
      jogadores: new Map(),
      partidaAtiva: false,
      semente: null
    };

    salas[codigo].jogadores.set(socket.id, { nome, eliminado: false });
    socket.join(codigo);
    codigoSalaAtual = codigo;

    console.log(`[Sala] ${nome} criou a sala ${codigo}`);

    socket.emit("salaCriada", {
      codigoSala: codigo,
      jogadores: obterNomesJogadores(salas[codigo])
    });

    // Verifica se já há jogadores suficientes (improvável ao criar, mas por segurança)
    verificarInicioPartida(codigo);
  });

  // ─────────────────────────────────────────────
  // Evento: entrarSala
  // Cliente envia: { codigoSala, nome }
  // Servidor responde: { sucesso, jogadores, erro? }
  // ─────────────────────────────────────────────
  socket.on("entrarSala", ({ codigoSala, nome }) => {
    const codigo = codigoSala.toUpperCase().trim();
    const sala = salas[codigo];

    if (!sala) {
      socket.emit("entrarSalaResposta", { sucesso: false, erro: "Sala não encontrada." });
      return;
    }

    if (sala.partidaAtiva) {
      socket.emit("entrarSalaResposta", { sucesso: false, erro: "Partida já em andamento." });
      return;
    }

    sala.jogadores.set(socket.id, { nome, eliminado: false });
    socket.join(codigo);
    codigoSalaAtual = codigo;

    console.log(`[Sala] ${nome} entrou na sala ${codigo}`);

    // Notifica todos na sala sobre a nova lista
    io.to(codigo).emit("entrarSalaResposta", {
      sucesso: true,
      jogadores: obterNomesJogadores(sala)
    });

    // Verifica se já há jogadores suficientes para iniciar
    verificarInicioPartida(codigo);
  });

  // ─────────────────────────────────────────────
  // Verifica se a sala tem >=2 jogadores e inicia a partida
  // ─────────────────────────────────────────────
  function verificarInicioPartida(codigo) {
    const sala = salas[codigo];
    if (!sala || sala.partidaAtiva) return;

    if (sala.jogadores.size >= 2) {
      const semente = gerarSemente();
      sala.semente = semente;
      sala.partidaAtiva = true;

      // Reseta eliminados
      sala.jogadores.forEach(jogador => {
        jogador.eliminado = false;
      });

      console.log(`[Partida] Iniciando partida na sala ${codigo} com semente ${semente}`);
      io.to(codigo).emit("iniciarPartida", { sementeSequencia: semente });
    }
  }

  // ─────────────────────────────────────────────
  // Evento: estadoJogador
  // Cliente envia: { playfield, tetromino }
  // Servidor retransmite aos outros como: estadoAdversario
  // ─────────────────────────────────────────────
  socket.on("estadoJogador", (estado) => {
    if (!codigoSalaAtual || !salas[codigoSalaAtual]) return;

    // Retransmite o estado para todos na sala exceto o remetente
    // Inclui o nome do jogador para exibição no painel do adversário
    socket.to(codigoSalaAtual).emit("estadoAdversario", {
      id: socket.id,
      playfield: estado.playfield,
      tetromino: estado.tetromino,
      nome: estado.nome || (salas[codigoSalaAtual].jogadores.get(socket.id) || {}).nome || "?"
    });
  });

  // ─────────────────────────────────────────────
  // Evento: linhasPenalidade
  // Cliente envia: quantidade (número)
  // Servidor envia receberPenalidade a todos exceto remetente
  // ─────────────────────────────────────────────
  socket.on("linhasPenalidade", (quantidade) => {
    if (!codigoSalaAtual || !salas[codigoSalaAtual]) return;

    console.log(`[Penalidade] ${socket.id} enviou ${quantidade} linha(s) de penalidade na sala ${codigoSalaAtual}`);
    socket.to(codigoSalaAtual).emit("receberPenalidade", quantidade);
  });

  // ─────────────────────────────────────────────
  // Evento: jogadorEliminado
  // Cliente avisa que perdeu
  // Servidor verifica se restou apenas 1 ativo → emite vencedor
  // ─────────────────────────────────────────────
  socket.on("jogadorEliminado", () => {
    if (!codigoSalaAtual || !salas[codigoSalaAtual]) return;

    const sala = salas[codigoSalaAtual];
    const jogador = sala.jogadores.get(socket.id);
    if (!jogador) return;

    jogador.eliminado = true;
    console.log(`[Eliminado] ${jogador.nome} foi eliminado na sala ${codigoSalaAtual}`);

    // Conta jogadores ainda ativos
    const ativos = [];
    sala.jogadores.forEach((j, id) => {
      if (!j.eliminado) ativos.push({ id, nome: j.nome });
    });

    if (ativos.length === 1) {
      const vencedor = ativos[0];
      console.log(`[Vencedor] ${vencedor.nome} venceu na sala ${codigoSalaAtual}`);
      io.to(codigoSalaAtual).emit("vencedor", vencedor.nome);
      sala.partidaAtiva = false;
    } else if (ativos.length === 0) {
      // Empate (todos eliminados ao mesmo tempo)
      io.to(codigoSalaAtual).emit("vencedor", null);
      sala.partidaAtiva = false;
    }
  });

  // ─────────────────────────────────────────────
  // Evento: reiniciarSala
  // Reinicia a sala com nova semente para todos
  // ─────────────────────────────────────────────
  socket.on("reiniciarSala", () => {
    if (!codigoSalaAtual || !salas[codigoSalaAtual]) return;

    const sala = salas[codigoSalaAtual];

    if (sala.jogadores.size < 2) {
      socket.emit("aguardandoJogadores");
      return;
    }

    const novaSemente = gerarSemente();
    sala.semente = novaSemente;
    sala.partidaAtiva = true;

    // Reseta eliminados
    sala.jogadores.forEach(jogador => {
      jogador.eliminado = false;
    });

    console.log(`[Reinício] Sala ${codigoSalaAtual} reiniciada com semente ${novaSemente}`);
    io.to(codigoSalaAtual).emit("salaReiniciada", { sementeSequencia: novaSemente });
  });

  // ─────────────────────────────────────────────
  // Desconexão
  // ─────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`[Desconexão] Socket desconectado: ${socket.id}`);

    if (!codigoSalaAtual || !salas[codigoSalaAtual]) return;

    const sala = salas[codigoSalaAtual];
    const jogador = sala.jogadores.get(socket.id);
    const nome = jogador ? jogador.nome : "Desconhecido";

    sala.jogadores.delete(socket.id);

    console.log(`[Sala] ${nome} saiu da sala ${codigoSalaAtual}. Jogadores restantes: ${sala.jogadores.size}`);

    // Notifica os demais
    io.to(codigoSalaAtual).emit("jogadorSaiu", { id: socket.id, nome });

    // Se a partida estava ativa e sobrou só 1 jogador, ele vence
    if (sala.partidaAtiva && sala.jogadores.size === 1) {
      const [vencedorId, vencedorInfo] = [...sala.jogadores.entries()][0];
      console.log(`[Vencedor] ${vencedorInfo.nome} venceu por desistência na sala ${codigoSalaAtual}`);
      io.to(codigoSalaAtual).emit("vencedor", vencedorInfo.nome);
      sala.partidaAtiva = false;
    }

    // Remove a sala se ficar vazia
    if (sala.jogadores.size === 0) {
      delete salas[codigoSalaAtual];
      console.log(`[Sala] Sala ${codigoSalaAtual} removida (vazia)`);
    }

    codigoSalaAtual = null;
  });
});

// Inicia o servidor na porta 3000
const PORTA = process.env.PORT || 3000;
servidor.listen(PORTA, () => {
  console.log(`[Servidor] Tetris Multiplayer rodando em http://localhost:${PORTA}`);
});
