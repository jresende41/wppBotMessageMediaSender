const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Caminhos dos arquivos
const PLANILHA_PATH = path.join(__dirname, 'contatos.xlsx');
const LEGENDAS = ['legenda1.txt', 'legenda2.txt'];
const IMAGEM_PATH = path.join(__dirname, 'imagem.png');
const ENVIADOS_PATH = path.join(__dirname, 'enviados.txt');

// Lê as legendas em ordem
let legendas = [];
for (const arquivo of LEGENDAS) {
  try {
    const texto = fs.readFileSync(path.join(__dirname, arquivo), 'utf8').trim();
    legendas.push(texto || '📢 Promoção imperdível!');
  } catch {
    legendas.push('📢 Promoção imperdível!');
  }
}

// Lê os números já enviados
let enviados = [];
if (fs.existsSync(ENVIADOS_PATH)) {
  enviados = fs.readFileSync(ENVIADOS_PATH, 'utf8')
               .split('\n')
               .map(l => l.trim())
               .filter(l => l.length > 0);
}

// Função para registrar número enviado
function registrarEnvio(numero) {
  fs.appendFileSync(ENVIADOS_PATH, numero + '\n');
}

// Lê os contatos da planilha
let contatos = [];
try {
  const workbook = xlsx.readFile(PLANILHA_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  contatos = xlsx.utils.sheet_to_json(sheet);
} catch (err) {
  console.error('❌ Erro ao ler contatos.xlsx:', err.message);
  process.exit(1);
}

// Verifica se a imagem existe
if (!fs.existsSync(IMAGEM_PATH)) {
  console.error('❌ imagem.png não encontrada!');
  process.exit(1);
}

// Inicializa o cliente WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox']
  }
});

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  console.log('🔐 Sessão restaurada.');
});

client.on('ready', async () => {
  console.log('✅ WhatsApp conectado.');

  const media = MessageMedia.fromFilePath(IMAGEM_PATH);

  // Filtra contatos que ainda não receberam
  const contatosPendentes = contatos.filter(c => {
    const numeroRaw = c.numero?.toString().replace(/\D/g, '');
    const numeroFormatado = `${numeroRaw}@c.us`;
    return numeroRaw && numeroRaw.length >= 10 && !enviados.includes(numeroFormatado);
  });

  // Limita a 20 envios por hora
  const lote = contatosPendentes.slice(0, 20);

  for (let i = 0; i < lote.length; i++) {
    const contato = lote[i];
    const numeroRaw = contato.numero.toString().replace(/\D/g, '');
    const numeroFormatado = `${numeroRaw}@c.us`;
    const legenda = legendas[i % legendas.length];

    try {
      await client.sendMessage(numeroFormatado, media, { caption: legenda });
      registrarEnvio(numeroFormatado);
      console.log(`✅ ${numeroFormatado}`);
    } catch (err) {
      console.log(`❌ ${numeroFormatado}`);
    }

    // Aguarda intervalo aleatório entre 60 e 120 segundos
    const intervalo = Math.floor(Math.random() * (120 - 60 + 1)) + 60;
    console.log(`⏳ Aguardando ${intervalo} segundos...`);
    await new Promise(resolve => setTimeout(resolve, intervalo * 1000));
  }

  console.log('🏁 Lote de 20 envios concluído. Encerrando bot.');
  process.exit(0);
});

client.initialize();
