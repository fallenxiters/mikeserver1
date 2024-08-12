const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const flash = require('express-flash');
const { createPool } = require('mysql2/promise');
require('dotenv').config();
const fs = require('fs');
const moment = require('moment');
const multer  = require('multer');
const crypto = require('crypto');
const axios = require('axios');
const WebSocket = require('ws');


const app = express();

// Middleware para adicionar o cabeçalho ngrok-skip-browser-warning
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});


app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configurar o middleware para analisar dados do corpo da solicitação
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

let serverStatus = null;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  connectionLimit: 15,
  insecureAuth: true // Configuração para desativar o uso de SSL
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
    return;
  }
  console.log('Conexão bem-sucedida ao banco de dados!');
  connection.release();
});

module.exports = pool;


const localConnection = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  connectionLimit: 15,
  insecureAuth: true // Configuração para desativar o uso de SSL
});

app.use((req, res, next) => {
  req.pool = pool;
  req.localConnection = localConnection;
  next();
});




const sessionStore = new MySQLStore({
  expiration: 24 * 60 * 60 * 1000, // 24 horas em milissegundos
  endConnectionOnClose: false,
}, pool);

const connectToDatabase = async () => {
  const connection = await pool.getConnection();
  return connection;
};

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  store: new MySQLStore({}, pool),
  cookie: {
    secure: process.env.NODE_ENV === 'true', // Altere para true em produção
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      console.log("Tentativa de autenticação para o vendedor:", username);

      const [user] = await pool.query('SELECT * FROM sellers WHERE username = ?', [username]);

      if (user.length === 0 || password !== user[0].password) {
        console.log("Falha na autenticação para o vendedor:", username);
        return done(null, false, { message: 'Usuário ou senha incorretos' });
      }

      console.log("Autenticação bem-sucedida para o vendedor:", username);
      return done(null, user[0]);
    } catch (err) {
      console.error("Erro na autenticação:", err);
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const connection = await connectToDatabase();
    const [rows] = await connection.query('SELECT id, username, password, nome FROM sellers WHERE id = ?', [id]);
    connection.release();

    if (rows.length === 0) {
      return done(null, false, { message: 'Usuário não encontrado' });
    }
    const user = rows[0];
    done(null, user);
  } catch (err) {
    return done(err);
  }
});

async function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

app.use((req, res, next) => {
  if (req.path !== '/login' && req.path !== '/logout') {
    ensureAuthenticated(req, res, next);
  } else {
    next();
  }
});

app.get('/menu', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'menu.html'));
});

app.get('/', (req, res) => {
  res.redirect('/login');
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/login',
  failureFlash: true,
}), (req, res) => {
  res.status(200).json({ message: 'Login bem-sucedido' });
});

app.get('/login', (req, res) => {
  res.render('login', { loginMessage: req.flash('error') });
  req.flash('error', ''); // Limpe as mensagens flash
});

// Rota para renderizar o dashboard
app.get('/dashboard', ensureAuthenticated, async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const vendedorNome = req.user.nome;
      const localConnection = req.pool;

      function formatDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      }

      function renderDashboard(res, user, tableContent, numExpiredKeys, numLogins) {
        res.render('dashboard', { creditsAmount, username: vendedorNome, errorMessage, user, tableContent, numExpiredKeys, numLogins });
      }

      if (!localConnection) {
        console.error('Conexão local não definida');
        return res.status(500).send('Erro no servidor');
      }

      const [vendedorData] = await localConnection.query('SELECT creditos FROM sellers WHERE nome = ?', [vendedorNome]);

      if (vendedorData.length === 0) {
        console.error('Vendedor não encontrado.');
        return res.status(500).send('Vendedor não encontrado.');
      }

      const creditsAmount = vendedorData[0].creditos;
      const errorMessage = req.flash('error');

      // Consulta para verificar as permissões do vendedor
      const [vendedorPermissao] = await localConnection.query(
        'SELECT can_view_any_key, can_create_admins, can_modify_credits, can_view_admins, can_view_packages FROM sellers WHERE nome = ?',
        [vendedorNome]
      );

      if (vendedorPermissao.length === 0) {
        console.error('Permissões do vendedor não encontradas.');
        return res.status(500).send('Permissões do vendedor não encontradas.');
      }

      const user = {
        vendedor_nome: vendedorNome,
        can_create_admins: vendedorPermissao[0].can_create_admins === 1,
        can_modify_credits: vendedorPermissao[0].can_modify_credits === 1,
        can_view_admins: vendedorPermissao[0].can_view_admins === 1,
        can_view_packages: vendedorPermissao[0].can_view_packages === 1,
        can_view_any_key: vendedorPermissao[0].can_view_any_key === 1
      };

      // Consulta para obter os dados dos usuários_keys
      let query = 'SELECT * FROM users_keys';

      // Verifica se o vendedor pode ver todas as chaves ou apenas as suas próprias
      if (!user.can_view_any_key) {
        query += ' WHERE seller = ?'; // Se não tiver permissão, filtra apenas as chaves do vendedor
      }

      query += ' ORDER BY expirydate DESC'; // Ordena por data de expiração decrescente

      const [userRows] = await localConnection.query(query, !user.can_view_any_key ? [vendedorNome] : []);
      const [expiredUserRows] = await localConnection.query(
        'SELECT * FROM users_keys WHERE seller = ? AND expirydate < NOW() ORDER BY expirydate DESC',
        [vendedorNome]
      );

      const numLogins = userRows.length; // Número de chaves criadas pelo vendedor
      const limitedRows = userRows.slice(0, 4);
      const tableContent = limitedRows.map(row => ({
        key: row.key,
        length: row.length,
        expirydate: row.expirydate ? formatDate(new Date(row.expirydate)) : 'Pendente',
        udid: row.udid ? '1/1' : '0/1',
      }));

      const numExpiredKeys = expiredUserRows.length;

      // Renderiza o dashboard com os dados obtidos
      renderDashboard(res, user, tableContent, numExpiredKeys, numLogins);

    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      res.status(500).send('Erro ao buscar dados do dashboard.');
    }
  } else {
    req.flash('error', 'Você não está autenticado.');
    res.redirect('/login');
  }
});







app.get('/logout', (req, res) => {
  req.logout(function() {});
  res.redirect('/login');
});



// Rota para renderizar o registro de chaves
app.get('/register', ensureAuthenticated, async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.redirect('/login');
    }

    const loggedInVendor = req.user;
    const vendedorNome = req.user.nome;

    let localConnection = req.pool; // Use a conexão da pool definida como req.pool

    if (!localConnection) {
      console.error('Conexão local não definida');
      return res.status(500).send('Erro no servidor');
    }

    // Consulta para verificar as permissões do vendedor autenticado
    const [vendedorPermissao] = await localConnection.query(
      'SELECT can_reset_any_key, can_modify_credits, can_view_admins, can_create_admins, can_view_packages FROM sellers WHERE nome = ?',
      [vendedorNome]
    );

    if (vendedorPermissao.length === 0) {
      console.log('Vendedor:', req.user.nome, 'não encontrado no banco de dados.');
      return res.status(500).send('Vendedor não encontrado.');
    }

    let user = {
      vendedor_nome: vendedorNome,
      can_reset_any_key: vendedorPermissao[0].can_reset_any_key === 1,
      can_modify_credits: vendedorPermissao[0].can_modify_credits === 1,
      can_view_admins: vendedorPermissao[0].can_view_admins === 1,
      can_create_admins: vendedorPermissao[0].can_create_admins === 1,
      can_view_packages: vendedorPermissao[0].can_view_packages === 1
    };

    const [vendedorData] = await localConnection.query('SELECT creditos FROM sellers WHERE nome = ?', [vendedorNome]);

    if (vendedorData.length === 0) {
      // Vendedor não encontrado, lide com isso como apropriado
      return res.status(500).send('Vendedor não encontrado.');
    }

    const creditsAmount = vendedorData[0].creditos;

    const [vendors] = await localConnection.query('SELECT id, username FROM sellers');

    // Obter todos os pacotes do banco de dados, independentemente das permissões
    const [packagesData] = await localConnection.query('SELECT id, package FROM packages');
    const packages = packagesData;

    res.render('register', {
      loggedInVendor,
      username: vendedorNome,
      vendors,
      creditsAmount,
      user,
      packages
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao buscar dados no banco de dados');
  }
});





const generateRandomString = (length) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const sanitizeVendorName = (name) => {
  return name.toLowerCase().replace(/\s+/g, '');
};

app.post('/add_user', ensureAuthenticated, async (req, res) => {
  try {
    const { expiration, currentDateTime, package: packageName } = req.body;
    const vendedorNome = req.user.nome; // Obtenha o nome do vendedor autenticado
    
    console.log('Recebido packageName:', packageName); // Log do packageName recebido

    let localConnection; // Defina a variável localConnection aqui

    // Função para gerar uma chave única
    const generateUniqueKey = async (vendedorNomeSanitized, expirationLabel) => {
      let uniqueKey;
      let isUnique = false;

      while (!isUnique) {
        const randomPart = generateRandomString(5);
        uniqueKey = `${vendedorNomeSanitized}-${expirationLabel}-${randomPart}`;

        const [existingKeys] = await req.pool.query('SELECT * FROM users_keys WHERE `key` = ?', [uniqueKey]);
        if (existingKeys.length === 0) {
          isUnique = true;
        }
      }

      return uniqueKey;
    };

    console.log('Tentativa de criação de chave por:', vendedorNome);

    // Obtenha os dados do vendedor da tabela sellers
    const [vendedorData] = await req.pool.query('SELECT * FROM sellers WHERE nome = ?', [vendedorNome]);

if (vendedorData[0].can_create_keys === 1) {
  const vendedorNomeSanitized = sanitizeVendorName(vendedorNome);
  const expirationLabel = expiration == 15 ? '15d' : '30d';
  const key = await generateUniqueKey(vendedorNomeSanitized, expirationLabel);

  localConnection = req.pool; // Use a conexão da pool definida como req.pool

  // Insira a chave na tabela
  await localConnection.query(
    'INSERT INTO users_keys (`key`, length, seller, status, package) VALUES (?, ?, ?, ?, ?)',
    [key, expiration, vendedorNome, 0, packageName]
  );

  console.log('Chave criada com sucesso', '|', 'Vendedor:', vendedorNome, '|', 'Chave:', key, '|', 'Validade:', expiration);

  return res.redirect(`/register?successMessage=Chave%20registrada%20com%20sucesso&key=${encodeURIComponent(key)}`);
} else {
  // Deduza os créditos necessários do vendedor APENAS se a inserção for bem-sucedida
  const creditosNecessarios = calcularCreditosNecessarios(expiration, packageName);
  console.log('Créditos necessários para a operação:', creditosNecessarios);

  if (vendedorData[0].creditos < creditosNecessarios) {
    console.log('Créditos insuficientes', '|', 'Vendedor:', vendedorNome);
    return res.redirect('/register?creditsAlert=Créditos%20insuficientes%20para%20registrar%20uma%20chave');
  }

  const vendedorNomeSanitized = sanitizeVendorName(vendedorNome);
  const expirationLabel = expiration == 15 ? '15d' : '30d';
  const key = await generateUniqueKey(vendedorNomeSanitized, expirationLabel);

  localConnection = req.pool; // Use a conexão da pool definida como req.pool

  // Insira a chave na tabela
  await localConnection.query(
    'INSERT INTO users_keys (`key`, length, seller, status, package) VALUES (?, ?, ?, ?, ?)',
    [key, expiration, vendedorNome, 0, packageName]
  );

  // Deduza os créditos necessários do vendedor
  await localConnection.query('UPDATE sellers SET creditos = creditos - ? WHERE nome = ?', [creditosNecessarios, vendedorNome]);

  console.log('Chave criada com sucesso', '|', 'Vendedor:', vendedorNome, '|', 'Chave:', key, '|', 'Validade:', expiration);

  return res.redirect(`/register?successMessage=Chave%20registrada%20com%20sucesso&key=${encodeURIComponent(key)}`);
}
  } catch (err) {
    console.error('Erro ao processar a solicitação:', err);
    return res.redirect('/register?errorMessage=Erro%20ao%20registrar%20chave');
  }
});




function calcularCreditosNecessarios(expiration, packageName) {
  const duracaoEmDias = parseInt(expiration, 10);

  if (packageName === 'PAINEL EXTERNAL') {
    if (duracaoEmDias === 30) {
      return 2;
    } else if (duracaoEmDias === 15) {
      return 1;
    }
  } else if (packageName === 'PAINEL EXTERNAL ANDROID') {
    if (duracaoEmDias === 30) {
      return 3;
    } else if (duracaoEmDias === 15) {
      return 1.5;
    }
  }

  return 0; // Caso não corresponda a nenhuma combinação válida
}





app.get('/get_credits', async (req, res) => {
  try {
    const vendedorNome = req.user.nome; // Obtenha o nome do vendedor autenticado
    // Realize uma consulta para buscar os créditos do vendedor com base em seu nome
    const [vendedor] = await connection.query('SELECT credits FROM sellers WHERE nome = ?', [vendedorNome]);
    
    // Verifique se o vendedor foi encontrado
    if (vendedor.length > 0) {
      // Envie os créditos do vendedor em formato JSON
      res.json({ creditsAmount: vendedor[0].credits });
    } else {
      // Se o vendedor não for encontrado, envie uma resposta vazia ou um erro
      res.json({ creditsAmount: 0 });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ creditsAmount: 0 });
  }
});

// Rota para renderizar a página /remove
app.get('/remove', ensureAuthenticated, async (req, res) => {
  try {
    const vendedorNome = req.user.nome;
    const localConnection = req.pool;

    if (!localConnection) {
      console.error('Conexão local não definida');
      return res.status(500).send('Erro no servidor');
    }

    const [vendedorData] = await localConnection.query('SELECT creditos FROM sellers WHERE nome = ?', [vendedorNome]);

    if (vendedorData.length === 0) {
      return res.status(500).send('Vendedor não encontrado.');
    }

    const creditsAmount = vendedorData[0].creditos;

    // Consulta para verificar as permissões do vendedor autenticado
    const [vendedorPermissao] = await localConnection.query(
      'SELECT can_create_admins, can_modify_credits, can_view_admins, can_view_packages FROM sellers WHERE nome = ?',
      [vendedorNome]
    );

    if (vendedorPermissao.length === 0) {
      console.log('Vendedor:', req.user.nome, 'não encontrado no banco de dados.');
      return res.status(500).send('Vendedor não encontrado.');
    }

    let user = {
      vendedor_nome: vendedorNome,
      can_create_admins: vendedorPermissao[0].can_create_admins === 1,
      can_modify_credits: vendedorPermissao[0].can_modify_credits === 1,
      can_view_admins: vendedorPermissao[0].can_view_admins === 1,
      can_view_packages: vendedorPermissao[0].can_view_packages === 1
    };

    let keysQuery = 'SELECT `key` FROM users_keys';
    let queryParams = [];

    if (vendedorNome !== 'MIKE IOS') {
      keysQuery += ' WHERE seller = ?';
      queryParams.push(vendedorNome);
    }

    const [keys] = await localConnection.query(keysQuery, queryParams);

    res.render('remove_key', { creditsAmount, username: vendedorNome, user, keys });
  } catch (error) {
    console.error('Erro ao buscar dados do vendedor:', error);
    res.status(500).send('Erro ao buscar dados do vendedor.');
  }
});



app.post('/remove_key', ensureAuthenticated, async (req, res) => {
  try {
    const { key } = req.body;
    const vendedorNome = req.user.nome;
    const localConnection = req.pool;

    if (!localConnection) {
      console.error('Conexão local não definida');
      return res.status(500).send('Erro no servidor');
    }

    const [existingKey] = await localConnection.query('SELECT seller FROM users_keys WHERE `key` = ?', [key]);

    if (existingKey.length === 0) {
      console.log('Vendedor:', req.user.nome, 'tentou remover a key', 'Key:', key, 'mas não existe');
      return res.redirect('/remove?nonexistentKeyAlert=Key%20não%20encontrada.%20Por%20favor,%20verifique%20a%20key.');
    }

    const keySeller = existingKey[0].seller;

    // Consulta para verificar as permissões do vendedor autenticado
    const [vendedorPermissao] = await localConnection.query(
      'SELECT can_remove_any_key FROM sellers WHERE nome = ?',
      [vendedorNome]
    );

    if (vendedorPermissao.length === 0) {
      console.log('Vendedor:', req.user.nome, 'não encontrado no banco de dados.');
      return res.status(500).send('Vendedor não encontrado.');
    }

    const canRemoveAnyKey = vendedorPermissao[0].can_remove_any_key === 1;

    if (canRemoveAnyKey || keySeller === vendedorNome) {
      await localConnection.query('DELETE FROM users_keys WHERE `key` = ?', [key]);
      console.log('Vendedor:', req.user.nome, 'removeu a key', 'Key:', key);
      return res.redirect('/remove?successAlert=Key%20removida%20com%20sucesso&successMessage=Key%20removida%20com%20sucesso');
    } else {
      console.log('Vendedor:', req.user.nome, 'tentou remover a key', 'Key:', key, 'mas não tem permissão');
      return res.redirect('/remove?errorRemoveAlert=Não%20é%20possível%20remover%20keys%20de%20outros%20sellers.%20Por%20favor,%20verifique%20a%20key.');
    }
  } catch (err) {
    console.error('Erro ao remover a key:', err);
    res.redirect('/remove?errorMessage=Erro%20ao%20remover%20key');
  }
});



app.get('/reset', ensureAuthenticated, async (req, res) => {
  if (req.isAuthenticated()) {
    const vendedorNome = req.user.nome;

    try {
      let localConnection = req.pool; // Use a conexão da pool definida como req.pool

      // Consulta para verificar as permissões do vendedor autenticado
      const [vendedorPermissao] = await localConnection.query(
        'SELECT can_reset_any_key, can_modify_credits, can_view_admins, can_create_admins, can_view_packages FROM sellers WHERE nome = ?',
        [vendedorNome]
      );

      if (vendedorPermissao.length === 0) {
        console.log('Vendedor:', req.user.nome, 'não encontrado no banco de dados.');
        return res.status(500).send('Vendedor não encontrado.');
      }

      const user = {
        vendedor_nome: vendedorNome,
        can_reset_any_key: vendedorPermissao[0].can_reset_any_key === 1,
        can_modify_credits: vendedorPermissao[0].can_modify_credits === 1,
        can_view_admins: vendedorPermissao[0].can_view_admins === 1,
        can_create_admins: vendedorPermissao[0].can_create_admins === 1,
        can_view_packages: vendedorPermissao[0].can_view_packages === 1
      };

      // Consulta as chaves baseado na permissão do vendedor
      let keysQuery = 'SELECT `key` FROM users_keys';
      let queryParams = []; // Definir a variável queryParams aqui

      // Se o vendedor não tem permissão can_reset_any_key, limita a consulta às chaves dele
      if (!user.can_reset_any_key) {
        keysQuery += ' WHERE seller = ?';
        queryParams.push(vendedorNome);
      }

      const [keys] = await localConnection.query(keysQuery, queryParams);

      // Obtenha os créditos do vendedor para passar para o EJS
      const [vendedorData] = await localConnection.query('SELECT creditos FROM sellers WHERE nome = ?', [vendedorNome]);

      if (vendedorData.length === 0) {
        return res.status(500).send('Vendedor não encontrado.');
      }

      const creditsAmount = vendedorData[0].creditos;

      // Renderize o arquivo EJS e passe os dados do vendedor e as chaves
      res.render('reset_key', { creditsAmount, username: vendedorNome, user, keys });

    } catch (error) {
      console.error('Erro ao buscar as keys do vendedor:', error);
      return res.status(500).send('Erro ao buscar as keys do vendedor.');
    }
  } else {
    res.redirect('/login');
  }
});


app.post('/reset_key', ensureAuthenticated, async (req, res) => {
  try {
    const { key } = req.body; // Obtenha a key do corpo da requisição
    const vendedorNome = req.user.nome; // Obtenha o nome do vendedor autenticado

    let localConnection = req.pool; // Use a conexão da pool definida como req.pool

    // Consulta para verificar as permissões do vendedor autenticado
    const [vendedorPermissao] = await localConnection.query(
      'SELECT can_reset_any_key FROM sellers WHERE nome = ?',
      [vendedorNome]
    );

    if (vendedorPermissao.length === 0) {
      console.log('Vendedor:', req.user.nome, 'não encontrado no banco de dados.');
      return res.status(500).send('Vendedor não encontrado.');
    }

    const canResetAnyKey = vendedorPermissao[0].can_reset_any_key === 1;

    // Consulta para obter o vendedor da chave
    const [existingKey] = await localConnection.query('SELECT seller FROM users_keys WHERE `key` = ?', [key]);

    if (existingKey.length === 0) {
      console.log('Vendedor:', req.user.nome, 'tentou resetar a key', 'Key:', key, 'mas não existe');
      return res.redirect('/reset?nonexistentKeyAlert=Key%20não%20encontrada.%20Por%20favor,%20verifique%20a%20key.');
    }

    const keyOwner = existingKey[0].seller;

    // Verifica se o vendedor pode resetar a key
    if (canResetAnyKey || keyOwner === vendedorNome) {
      const [result] = await localConnection.query('UPDATE users_keys SET udid = NULL WHERE `key` = ?', [key]);

      if (result.affectedRows > 0) {
        console.log('Vendedor:', req.user.nome, 'resetou a key', 'Key:', key);
        return res.redirect('/reset?successMessage=Key%20redefinida%20com%20sucesso');
      } else {
        console.log('Vendedor:', req.user.nome, 'tentou resetar a key', 'Key:', key, 'mas ocorreu um erro');
        return res.redirect('/reset?errorMessage=Erro%20ao%20redefinir%20a%20key');
      }
    } else {
      console.log('Vendedor:', req.user.nome, 'não tem permissão para resetar a key', 'Key:', key);
      return res.redirect('/reset?errorRemoveAlert=Você%20não%20tem%20permissão%20para%20redefinir%20esta%20key');
    }
  } catch (err) {
    console.error('Erro ao redefinir a key:', err);
    return res.redirect('/reset?errorAlert=Erro%20ao%20redefinir%20key');
  }
});




function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Os meses começam do zero
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Função para renderizar a tabela de usuários
function renderUserTable(res, rows, vendedorNome, user, creditsAmount) {
  const tableContent = rows.map(row => {
    let expiryDateText;
    if (!row.expirydate) {
      expiryDateText = 'Pendente';
    } else {
      const expiryDate = new Date(row.expirydate);
      const isExpired = expiryDate < new Date();
      expiryDateText = isExpired ? 'Expirado' : formatDate(expiryDate);
    }

    // Construa o objeto da linha da tabela com os dados necessários
    const tableRow = {
      id: row.id,
      key: row.key,
      length: row.length,
      expirydate: expiryDateText,
      udid: row.udid ? '1/1' : '0/1',
      package: row.package,
      status: row.status
    };

    return tableRow;
  });

  // Renderize o arquivo EJS e passe os dados para a página 'usuarios'
  res.render('usuarios', { tableContent, creditsAmount, username: vendedorNome, user });
}



// Rota para renderizar a página de usuários
app.get('/users', ensureAuthenticated, async (req, res) => {
  try {
    const vendedorNome = req.user.nome; // Obtenha o nome do vendedor autenticado

    const localConnection = req.pool;
    if (!localConnection) {
      console.error('Conexão local não definida');
      return res.status(500).send('Erro no servidor');
    }

    // Consulta para verificar as permissões do vendedor
    const [vendedorData] = await localConnection.query('SELECT * FROM sellers WHERE nome = ?', [vendedorNome]);
    if (vendedorData.length === 0) {
      return res.status(500).send('Vendedor não encontrado.');
    }

    // Construa o objeto de permissões do usuário
    const user = {
      vendedor_nome: vendedorNome,
      can_create_admins: vendedorData[0].can_create_admins === 1,
      can_modify_credits: vendedorData[0].can_modify_credits === 1,
      can_view_admins: vendedorData[0].can_view_admins === 1,
      can_view_packages: vendedorData[0].can_view_packages === 1,
      can_view_any_key: vendedorData[0].can_view_any_key === 1
      // Adicione outras permissões conforme necessário
    };

    // Consulta para obter os dados dos usuários_keys
    let query = 'SELECT id, `key`, udid, expirydate, length, seller, status, package FROM users_keys';

    // Verifica se o vendedor tem permissão para ver todas as chaves
    if (!user.can_view_any_key) {
      query += ' WHERE seller = ?'; // Se não tiver permissão, filtra apenas as chaves do vendedor
    }

    query += ' ORDER BY id DESC'; // Adiciona a cláusula ORDER BY para ordenar por ID de forma decrescente

    const [rows] = await localConnection.query(query, !user.can_view_any_key ? [vendedorNome] : []);

    // Consulta para obter os créditos do vendedor
    const [creditsData] = await localConnection.query('SELECT creditos FROM sellers WHERE nome = ?', [vendedorNome]);
    const creditsAmount = creditsData.length > 0 ? creditsData[0].creditos : 0;

    // Renderiza a página 'usuarios' passando as informações necessárias
    renderUserTable(res, rows, vendedorNome, user, creditsAmount);

  } catch (err) {
    console.error('Erro ao buscar os usuários:', err);
    res.status(500).send('Erro ao buscar os usuários no banco de dados');
  }
});


// Rota para acessar a página de criação de vendedor
app.get('/add-admins', ensureAuthenticated, async (req, res) => {
  // Obtenha o nome do vendedor autenticado
  const vendedorNome = req.user.nome;
  
                        // Renderize o arquivo EJS e passe os dados do vendedor
      const [vendedorData] = await localConnection.query('SELECT creditos FROM sellers WHERE nome = ?', [vendedorNome]);

      if (vendedorData.length === 0) {
        // Vendedor não encontrado, lide com isso como apropriado
        return res.status(500).send('Vendedor não encontrado.');
      }

      const creditsAmount = vendedorData[0].creditos;

  // Verifique se o vendedor autenticado é "MIKE IOS" ou "MATHEUS 08B"
  if (req.isAuthenticated() && (vendedorNome === 'MIKE IOS' || vendedorNome === 'MATHEUS 08B')) {
    // O vendedor é "MIKE IOS" ou "MATHEUS 08B", então ele pode criar um login de vendedor
    res.render('create_vendedor', { creditsAmount, username: vendedorNome }); // Renderize uma página de criação de vendedor
  } else {
    // Se o vendedor não for "MIKE IOS" ou "MATHEUS 08B," redirecione para uma página de erro ou exiba uma mensagem
    res.status(403).send('Você não tem permissão para acessar essa página.');
  }
});

// Rota para lidar com o envio do formulário de criação de vendedor
app.post('/create_vendedor', async (req, res) => {
  // Obtenha o nome do vendedor autenticado
  const vendedorNome = req.user.nome;

  // Verifique se o vendedor autenticado é "MIKE IOS" ou "MATHEUS 08B"
  if (req.isAuthenticated() && (vendedorNome === 'MIKE IOS' || vendedorNome === 'MATHEUS 08B')) {
    // Os detalhes do novo vendedor estão disponíveis em req.body
    const { username, password, nome, creditos } = req.body;

    // Verifique se todos os campos foram preenchidos
    if (!username || !password || !nome || !creditos) {
      return res.redirect('/add-admins?error=Preencha%20todos%20os%20campos'); // Redirecione em caso de campos em branco
    }

    // Insira os detalhes do novo vendedor na tabela de sellers
    try {
      await localConnection.query('INSERT INTO sellers (username, password, nome, creditos) VALUES (?, ?, ?, ?)', [username, password, nome, creditos]);
      res.redirect('/add-admins?successMessage=Vendedor%20criado%20com%20sucesso'); // Redirecione para a página de sucesso
    } catch (error) {
      console.error(error);
      res.redirect('/add-admins?errorMessage=Erro%20ao%20criar%20o%20vendedor'); // Em caso de erro
    }
  } else {
    // Se o vendedor não for "MIKE IOS" ou "MATHEUS 08B," redirecione para uma página de erro ou exiba uma mensagem
    res.status(403).send('Você não tem permissão para acessar essa página.');
  }
});



// Rota para acessar a página de créditos
app.get('/credits', ensureAuthenticated, async (req, res) => {
  // Obtenha o nome do vendedor autenticado
  const vendedorNome = req.user.nome;
  
                      // Renderize o arquivo EJS e passe os dados do vendedor
      const [vendedorData] = await localConnection.query('SELECT creditos FROM sellers WHERE nome = ?', [vendedorNome]);

      if (vendedorData.length === 0) {
        // Vendedor não encontrado, lide com isso como apropriado
        return res.status(500).send('Vendedor não encontrado.');
      }

      const creditsAmount = vendedorData[0].creditos;

  // Verifique se o vendedor autenticado é "MIKE IOS" ou "MATHEUS 08B"
  if (vendedorNome === 'MIKE IOS' || vendedorNome === 'MATHEUS 08B') {
    // Se o vendedor for "MIKE IOS" ou "MATHEUS 08B," renderize a página de créditos
    res.render('credits.ejs', { creditsAmount, username: vendedorNome });
  } else {
    // Se o vendedor não for "MIKE IOS" ou "MATHEUS 08B," redirecione para uma página de erro ou exiba uma mensagem
    res.status(403).send('Você não tem permissão para acessar essa página.');
  }
});

app.post('/add_credits', async (req, res) => {
  const vendedorNome = req.user.nome; // Obtenha o nome do vendedor autenticado
  const { username, credits, action } = req.body;

  if (vendedorNome === 'MIKE IOS' || vendedorNome === 'MATHEUS 08B') {
    // Se o vendedor for "MIKE IOS" ou "MATHEUS 08B", permita que ele adicione ou remova créditos do vendedor especificado
    // Primeiro, verifique se o vendedor existe na tabela de sellers
    const [existingVendedor] = await localConnection.query('SELECT * FROM sellers WHERE username = ?', [username]);

    if (existingVendedor.length > 0) {
      // Se o vendedor existe, atualize os créditos com base na ação
      const currentCredits = existingVendedor[0].creditos || 0;
      const parsedCredits = parseFloat(credits); // Converta para número decimal

      if (action === 'add') {
        // Adicionar créditos
        const newCredits = currentCredits + parsedCredits;
        await localConnection.query('UPDATE sellers SET creditos = ? WHERE username = ?', [newCredits, username]);
        return res.redirect('/credits?successAddMessage=Créditos%20adicionados%20com%20sucesso');
      } else if (action === 'remove') {
        // Remover créditos
        if (currentCredits >= parsedCredits) {
          const newCredits = currentCredits - parsedCredits;
          await localConnection.query('UPDATE sellers SET creditos = ? WHERE username = ?', [newCredits, username]);
          return res.redirect('/credits?successRemoveMessage=Créditos%20removidos%20com%20sucesso');
        } else {
          // Se não houver créditos suficientes para remover, redirecione para uma página de erro
          return res.redirect('/credits?errorCreditsAlert=Créditos%20insuficientes%20para%20remoção.');
        }
      }
    } else {
      // Se o vendedor não existe, redirecione para uma página de erro
      return res.redirect('/credits?errorVendedorAlert=Vendedor%20não%20encontrado.%20Por%20favor,%20verifique%20o%20nome%20de%20usuário.');
    }
  } else {
    // Se o vendedor não for "MIKE IOS" ou "MATHEUS 08B", redirecione para uma página de erro ou exiba uma mensagem
    res.status(403).send('Você não tem permissão para essa ação.');
  }
});




app.post('/remove_credits', async (req, res) => {
  const vendedorNome = req.user.nome; // Obtenha o nome do vendedor autenticado
  const { username, credits } = req.body;

  if (vendedorNome === 'MIKE IOS' || vendedorNome === 'MATHEUS 08B') {
    // Se o vendedor for "MIKE IOS" ou "MATHEUS 08B", permita que ele remova créditos do vendedor especificado
    // Primeiro, verifique se o vendedor existe na tabela de sellers
    const [existingVendedor] = await localConnection.query('SELECT * FROM sellers WHERE username = ?', [username]);

    if (existingVendedor.length > 0) {
      // Se o vendedor existe, atualize os créditos com base na ação
      const currentCredits = existingVendedor[0].creditos || 0;
      const parsedCredits = parseFloat(credits); // Converta para número decimal

      if (currentCredits >= parsedCredits) {
        // Remover créditos
        const newCredits = currentCredits - parsedCredits;
        await localConnection.query('UPDATE sellers SET creditos = ? WHERE username = ?', [newCredits, username]);
        return res.redirect('/credits?successRemoveMessage=Créditos%20removidos%20com%20sucesso');
      } else {
        // Se não houver créditos suficientes para remover, redirecione para uma página de erro
        return res.redirect('/credits?errorCreditsAlert=Créditos%20insuficientes%20para%20remoção.');
      }
    } else {
      // Se o vendedor não existe, redirecione para uma página de erro
      return res.redirect('/credits?errorVendedorAlert=Vendedor%20não%20encontrado.%20Por%20favor,%20verifique%20o%20nome%20de%20usuário.');
    }
  } else {
    // Se o vendedor não for "MIKE IOS" ou "MATHEUS 08B", redirecione para uma página de erro ou exiba uma mensagem
    res.status(403).send('Você não tem permissão para essa ação.');
  }
});



// Função para renderizar a tabela de admins
function renderAdminsTable(res, adminsData, vendedorNome, creditsAmount) {
  // Mapeia os dados dos admins para o formato esperado na tabela
  const tableContent = adminsData.map(admin => ({
    id: admin.id,
    username: admin.username,
    password: admin.password,
    nome: admin.nome,
    creditos: admin.creditos,
    can_create_keys: admin.can_create_keys,
    can_reset_any_key: admin.can_reset_any_key,
    can_remove_any_key: admin.can_remove_any_key,
    can_view_any_key: admin.can_view_any_key,
    can_modify_credits: admin.can_modify_credits,
    can_view_admins: admin.can_view_admins,
    can_create_admins: admin.can_create_admins,
    can_view_packages: admin.can_view_packages
  }));

  // Renderiza o arquivo EJS e passa os dados necessários
  res.render('admins', {
    creditsAmount,
    tableContent,
    username: vendedorNome
  });
}

// Rota para exibir os administradores
app.get('/admins', async (req, res) => {
  const vendedorNome = req.user.nome;

  // Verifica se o vendedor é "MIKE IOS" ou "MATHEUS 08B"
  if (vendedorNome === 'MIKE IOS' || vendedorNome === 'MATHEUS 08B') {
    try {
      // Busca os créditos do vendedor
      const [vendedorData] = await localConnection.query('SELECT creditos FROM sellers WHERE nome = ?', [vendedorNome]);

      if (vendedorData.length === 0) {
        return res.status(500).send('Vendedor não encontrado.');
      }

      const creditsAmount = vendedorData[0].creditos;

      // Busca todos os administradores (sellers) do banco de dados
      const [admins] = await localConnection.query('SELECT id, username, password, nome, creditos, can_create_keys, can_reset_any_key, can_remove_any_key, can_view_any_key, can_modify_credits, can_view_admins, can_create_admins, can_view_packages FROM sellers');

      // Chama a função para renderizar a tabela de admins
      renderAdminsTable(res, admins, vendedorNome, creditsAmount);

    } catch (error) {
      console.error('Erro ao buscar administradores:', error);
      res.status(500).send('Erro ao buscar administradores');
    }
  } else {
    res.status(403).send('Você não tem permissão para acessar esta página');
  }
});





async function buscarCreditosVendedor(vendedorNome, localConnection) {
  try {
    const [vendedorData] = await localConnection.query('SELECT creditos FROM sellers WHERE nome = ?', [vendedorNome]);
    if (vendedorData.length > 0) {
      return vendedorData[0].creditos;
    }
    return 0; // Ou algum valor padrão caso o vendedor não seja encontrado
  } catch (error) {
    console.error('Erro ao buscar créditos do vendedor:', error);
    return 0; // Trate o erro ou retorne um valor padrão
  }
}



// Rota para deletar keys expiradas
app.post('/delete-expired-keys', ensureAuthenticated, async (req, res) => {
  try {
    const vendedorNome = req.user.nome;
    console.log('Vendedor:', vendedorNome);

    let deletedCount = 0;
    let query = 'DELETE FROM users_keys WHERE expirydate < NOW()';

    // Consulta para obter as permissões do vendedor
    const [vendedorPermissao] = await req.pool.query(
      'SELECT can_view_any_key FROM sellers WHERE nome = ?',
      [vendedorNome]
    );

    if (vendedorPermissao.length === 0) {
      console.error('Permissões do vendedor não encontradas.');
      return res.status(500).send('Permissões do vendedor não encontradas.');
    }

    // Verifica se o vendedor pode visualizar todas as chaves
    if (vendedorPermissao[0].can_view_any_key === 0) {
      // Se não puder, limita a deleção às suas próprias chaves expiradas
      query += ' AND seller = ?';
    }

    const result = await req.pool.query(query, [vendedorNome]);
    deletedCount = result[0].affectedRows; // Captura o número de linhas afetadas do primeiro elemento do array
    console.log('Resultado da query:', result);

    console.log('Número de keys deletadas:', deletedCount);
    res.status(200).json({ deletedCount }); // Envia o número de linhas deletadas como resposta JSON
  } catch (error) {
    console.error('Erro ao deletar keys expiradas:', error);
    res.status(500).send('Erro ao deletar keys expiradas');
  }
});


// Rota para resetar todas as keys
app.post('/reset-all', ensureAuthenticated, async (req, res) => {
  try {
    const vendedorNome = req.user.nome;

    let query = 'UPDATE users_keys SET udid = NULL';

    // Consulta para obter as permissões do vendedor
    const [vendedorPermissao] = await req.pool.query(
      'SELECT can_view_any_key FROM sellers WHERE nome = ?',
      [vendedorNome]
    );

    if (vendedorPermissao.length === 0) {
      console.error('Permissões do vendedor não encontradas.');
      return res.status(500).send('Permissões do vendedor não encontradas.');
    }

    // Verifica se o vendedor pode visualizar todas as chaves
    if (vendedorPermissao[0].can_view_any_key === 0) {
      // Se não puder, limita o reset às suas próprias chaves
      query += ' WHERE seller = ?';
    }

    await req.pool.query(query, [vendedorNome]);

    res.status(200).send('Todos os dados foram resetados com sucesso');
  } catch (error) {
    console.error('Erro ao resetar todos os dados:', error);
    res.status(500).send('Erro ao resetar todos os dados');
  }
});


app.get('/packages', ensureAuthenticated, async (req, res) => {
    try {
        const vendedorNome = req.user.nome; // Obtenha o nome do vendedor autenticado
        let user = {
            vendedor_nome: vendedorNome,
            // outros dados do usuário
        };
        
        // Renderize o arquivo EJS e passe os dados do vendedor
        const [vendedorData] = await localConnection.query('SELECT creditos FROM sellers WHERE nome = ?', [vendedorNome]);

        if (vendedorData.length === 0) {
            // Vendedor não encontrado, lide com isso como apropriado
            return res.status(500).send('Vendedor não encontrado.');
        }

        const creditsAmount = vendedorData[0].creditos;
    
        let query = 'SELECT id, `package`, token, version, status, remaining_seconds, link, online FROM packages';

        // Execute a query no banco de dados para obter os pacotes
        const [results] = await req.pool.query(query);

        const packages = results.map(row => ({
            id: row.id,
            package: row.package,
            version: row.version,
            status: row.status,
            token: row.token,
            seconds: row.remaining_seconds,
            link: row.link,
          online: row.online,
        }));

        res.render('packages', { creditsAmount, username: vendedorNome, user, packages });
        console.log('Renderizando view com pacotes'); // Log de renderização
    } catch (error) {
        console.error('Erro ao renderizar a página packages:', error); // Log de erro
        res.status(500).send('Erro ao carregar a página de pacotes');
    }
});


app.post('/change-status', ensureAuthenticated, async (req, res) => {
    try {
        const userKey = req.body.key;

        if (!userKey) {
            return res.status(400).json({ success: false, message: 'Key não fornecida' });
        }

        console.log(`Recebido pedido para mudar o status da key: ${userKey}`);

        // Verificar a key no banco de dados
        const query = 'SELECT status FROM users_keys WHERE `key` = ?';
        const [results] = await req.pool.query(query, [userKey]);

        console.log('Resultados da consulta:', results);

        if (results.length === 0) {
            console.log(`Key não encontrada: ${userKey}`);
            return res.status(404).json({ success: false, message: 'Key não encontrada' });
        }

        // Verificar o status atual
        const currentStatus = results[0].status;
        console.log(`Status atual: ${currentStatus}`);

        if (currentStatus === undefined) {
            console.log(`Status atual indefinido para a key: ${userKey}`);
            return res.status(500).json({ success: false, message: 'Status atual indefinido' });
        }

        // Alternar o status
        const newStatus = currentStatus === 0 ? 1 : 0;
        console.log(`Novo status: ${newStatus}`);

        const updateQuery = 'UPDATE users_keys SET status = ? WHERE `key` = ?';
        const updateResults = await req.pool.query(updateQuery, [newStatus, userKey]);

        console.log(`Resultado da atualização:`, updateResults);

        return res.json({ success: true, message: 'Status atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao mudar o status:', error);
        res.status(500).send('Erro ao mudar o status');
    }
});

app.post('/reset-key', ensureAuthenticated, async (req, res) => {
    try {
        const userKey = req.body.key;

        if (!userKey) {
            return res.status(400).json({ success: false, message: 'Key não fornecida' });
        }

        console.log(`Recebido pedido para resetar a key: ${userKey}`);

        // Resetar o UDID no banco de dados
        const resetQuery = 'UPDATE users_keys SET udid = NULL WHERE `key` = ?';
        const resetResults = await req.pool.query(resetQuery, [userKey]);

        console.log(`Resultado do reset:`, resetResults);

        return res.json({ success: true, message: 'Key resetada com sucesso' });
    } catch (error) {
        console.error('Erro ao resetar a key:', error);
        res.status(500).send('Erro ao resetar a key');
    }
});

app.post('/delete-key', ensureAuthenticated, async (req, res) => {
    try {
        const userKey = req.body.key;

        if (!userKey) {
            return res.status(400).json({ success: false, message: 'Key não fornecida' });
        }

        console.log(`Recebido pedido para deletar a key: ${userKey}`);

        // Deletar a key no banco de dados
        const deleteQuery = 'DELETE FROM users_keys WHERE `key` = ?';
        const deleteResults = await req.pool.query(deleteQuery, [userKey]);

        console.log(`Resultado da deleção:`, deleteResults);

        return res.json({ success: true, message: 'Key deletada com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar a key:', error);
        res.status(500).send('Erro ao deletar a key');
    }
});


app.post('/change-status-package', ensureAuthenticated, async (req, res) => {
    try {
        const package = req.body.package;

        if (!package) {
            return res.status(400).json({ success: false, message: 'Package não fornecido' });
        }

        console.log(`Recebido pedido para mudar o status do package: ${package}`);

        // Verificar o status atual no banco de dados
        const query = 'SELECT status FROM packages WHERE `package` = ?';
        const [results] = await req.pool.query(query, [package]);

        console.log('Resultados da consulta:', results);

        if (results.length === 0) {
            console.log(`Package não encontrado: ${package}`);
            return res.status(404).json({ success: false, message: 'Package não encontrado' });
        }

        // Verificar o status atual
        const currentStatus = results[0].status;
        console.log(`Status atual: ${currentStatus}`);

        if (currentStatus === undefined) {
            console.log(`Status atual indefinido para o package: ${package}`);
            return res.status(500).json({ success: false, message: 'Status atual indefinido' });
        }

        // Alternar o status
        const newStatus = currentStatus === 0 ? 1 : 0;
        console.log(`Novo status: ${newStatus}`);

        const updateQuery = 'UPDATE packages SET status = ? WHERE `package` = ?';
        const [updateResults] = await req.pool.query(updateQuery, [newStatus, package]);

        console.log(`Resultado da atualização:`, updateResults);

        return res.json({ success: true, message: 'Status atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao mudar o status:', error);
        res.status(500).send('Erro ao mudar o status');
    }
});

app.post('/update-package', ensureAuthenticated, async (req, res) => {
    try {
        const { id, name, version, remainingSeconds, packageLink } = req.body;

        if (!id || !name || !version || !remainingSeconds || packageLink === undefined) {
            console.log('Dados incompletos:', { id, name, version, remainingSeconds, packageLink });
            return res.status(400).json({ success: false, message: 'Dados incompletos' });
        }

        console.log(`Recebido pedido para atualizar o package ID: ${id}`);

        // Remove espaços em branco no início e no final e substitui múltiplos espaços por um único espaço
        const cleanedName = name.trim().replace(/\s+/g, ' ');

        // Verifica se o nome do pacote já existe (exceto para o próprio pacote que está sendo atualizado)
        const checkNameQuery = 'SELECT COUNT(*) as count FROM packages WHERE package = ? AND id != ?';
        const [nameRows] = await req.pool.query(checkNameQuery, [cleanedName, id]);
        if (nameRows[0].count > 0) {
            return res.status(400).json({ success: false, message: 'Nome do package já existe' });
        }

        const query = 'UPDATE packages SET package = ?, version = ?, remaining_seconds = ?, link = ? WHERE id = ?';
        const [result] = await req.pool.query(query, [cleanedName, version, remainingSeconds, packageLink, id]);

        if (result.affectedRows === 0) {
            console.log(`Package não encontrado: ID ${id}`);
            return res.status(404).json({ success: false, message: 'Package não encontrado' });
        }

        console.log(`Package ID ${id} atualizado com sucesso`);
        return res.json({ success: true, message: 'Package atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar o package:', error);
        res.status(500).send('Erro ao atualizar o package');
    }
});





app.post('/delete-package', ensureAuthenticated, async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ success: false, message: 'ID não fornecido' });
        }

        console.log(`Recebido pedido para deletar o package ID: ${id}`);

        const deleteQuery = 'DELETE FROM packages WHERE id = ?';
        const [result] = await req.pool.query(deleteQuery, [id]);

        if (result.affectedRows === 0) {
            console.log(`Package não encontrado: ID ${id}`);
            return res.status(404).json({ success: false, message: 'Package não encontrado' });
        }

        console.log(`Package ID ${id} deletado com sucesso`);
        return res.json({ success: true, message: 'Package deletado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar o package:', error);
        res.status(500).send('Erro ao deletar o package');
    }
});


app.post('/reset-keys-package', ensureAuthenticated, async (req, res) => {
    try {
        const { package } = req.body;

        if (!package) {
            return res.status(400).json({ success: false, message: 'Package não fornecido' });
        }

        console.log(`Recebido pedido para resetar keys do package: ${package}`);

        const resetQuery = 'UPDATE users_keys SET udid = NULL WHERE package = ?';
        const [result] = await req.pool.query(resetQuery, [package]);

        if (result.affectedRows === 0) {
            console.log(`Nenhuma key encontrada para o package: ${package}`);
            return res.status(404).json({ success: false, message: 'no-exist' });
        }

        console.log(`Keys do package ${package} resetadas com sucesso`);
        return res.json({ success: true, message: 'Keys resetadas com sucesso' });
    } catch (error) {
        console.error('Erro ao resetar as keys:', error);
        res.status(500).send('Erro ao resetar as keys');
    }
});

app.post('/create-package', ensureAuthenticated, async (req, res) => {
    try {
        const { name, version, link, remainingSeconds } = req.body;

        if (!name || !version || !link || !remainingSeconds) {
            return res.status(400).json({ success: false, message: 'Nome, versão, link ou segundos restantes do package não fornecidos' });
        }

        if (remainingSeconds < 60 || remainingSeconds > 300) {
            return res.status(400).json({ success: false, message: 'Segundos restantes devem estar entre 60 e 300' });
        }

        // Verifica se o nome do pacote já existe
        const checkNameQuery = 'SELECT COUNT(*) as count FROM packages WHERE package = ?';
        const [nameRows] = await req.pool.query(checkNameQuery, [name]);
        if (nameRows[0].count > 0) {
            return res.status(400).json({ success: false, message: 'Nome do package já existe' });
        }

        // Gera um token aleatório sem símbolos, exceto "/"
        const generateToken = (length) => {
            const buffer = crypto.randomBytes(length);
            let token = buffer.toString('base64');
            // Substitui os caracteres indesejados
            token = token.replace(/[^a-zA-Z0-9\/]/g, '');
            // Se o token resultante for menor que o comprimento desejado, gera novamente
            while (token.length < length) {
                token += generateToken(length - token.length);
            }
            return token;
        };

        let token;
        let isUnique = false;

        while (!isUnique) {
            token = generateToken(66);
            // Verifica se o token já existe no banco de dados
            const checkQuery = 'SELECT COUNT(*) as count FROM packages WHERE token = ?';
            const [rows] = await req.pool.query(checkQuery, [token]);
            if (rows[0].count === 0) {
                isUnique = true;
            }
        }

        const status = 0; // Status padrão (ativo)

        const insertQuery = 'INSERT INTO packages (package, version, link, token, status, remaining_seconds) VALUES (?, ?, ?, ?, ?, ?)';
        await req.pool.query(insertQuery, [name, version, link, token, status, remainingSeconds]);

        return res.json({ success: true, message: 'Package criado com sucesso' });
    } catch (error) {
        console.error('Erro ao criar o package:', error);
        res.status(500).send('Erro ao criar o package');
    }
});

// Rota para mudar o nome do vendedor
app.post('/change-name', ensureAuthenticated, async (req, res) => {
    const { username, newName } = req.body;

    try {
        if (!username || !newName) {
            return res.status(400).json({ success: false, message: 'Dados incompletos' });
        }

        console.log(`Tentativa de mudança de nome para o vendedor: ${newName}`);

        // Iniciar transação para garantir atomicidade das operações
        const connection = await req.pool.getConnection();
        await connection.beginTransaction();

        try {
            // Busca o nome atual do vendedor na tabela sellers
            const currentNameQuery = 'SELECT nome FROM sellers WHERE username = ?';
            const [currentNameResult] = await connection.query(currentNameQuery, [username]);

            if (currentNameResult.length === 0) {
                await connection.rollback();
                console.log(`Falha na atualização: vendedor não encontrado: ${username}`);
                return res.status(404).json({ success: false, message: 'Vendedor não encontrado' });
            }

            const currentName = currentNameResult[0].nome;

            console.log(`Nome atual do vendedor: ${currentName}`);

            // Atualiza o nome na tabela sellers
            const updateSellerQuery = 'UPDATE sellers SET nome = ? WHERE username = ?';
            const [sellerUpdateResult] = await connection.query(updateSellerQuery, [newName, username]);

            if (sellerUpdateResult.affectedRows === 0) {
                await connection.rollback();
                console.log(`Falha na atualização: vendedor não encontrado: ${username}`);
                return res.status(404).json({ success: false, message: 'Vendedor não encontrado' });
            }

            console.log(`Nome atualizado na tabela sellers para: ${newName}`);

            // Atualiza o nome na tabela users_keys
            const updateKeysQuery = 'UPDATE users_keys SET seller = ? WHERE seller = ?';
            const [keysUpdateResult] = await connection.query(updateKeysQuery, [newName, currentName]);

            console.log(`Número de keys atualizadas: ${keysUpdateResult.affectedRows}`);

            // Commit da transação se tudo ocorrer bem
            await connection.commit();
            console.log('Transação completada com sucesso.');

            return res.json({ success: true, message: 'Nome alterado com sucesso' });
        } catch (error) {
            await connection.rollback();
            console.error('Erro durante a transação:', error);
            throw error; // Propaga o erro para o bloco catch externo
        } finally {
            connection.release(); // Liberar conexão de volta ao pool
        }
    } catch (error) {
        console.error('Erro ao mudar o nome:', error);
        return res.status(500).send('Erro ao mudar o nome');
    }
});




// Rota para alterar a senha do vendedor
app.post('/change-password', ensureAuthenticated, async (req, res) => {
    try {
        const { username, newPassword } = req.body;

        if (!username || !newPassword) {
            return res.status(400).json({ success: false, message: 'Dados incompletos' });
        }

        const query = 'UPDATE sellers SET password = ? WHERE username = ?';
        const [result] = await pool.query(query, [newPassword, username]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Vendedor não encontrado' });
        }

        return res.json({ success: true, message: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error('Erro ao alterar a senha:', error);
        res.status(500).send('Erro ao alterar a senha');
    }
});

// Rota para deletar o vendedor
app.post('/delete-user', ensureAuthenticated, async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ success: false, message: 'Dados incompletos' });
        }

        const query = 'DELETE FROM sellers WHERE username = ?';
        const [result] = await pool.query(query, [username]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Vendedor não encontrado' });
        }

        return res.json({ success: true, message: 'Vendedor deletado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar o vendedor:', error);
        res.status(500).send('Erro ao deletar o vendedor');
    }
});

// Rota para receber os dados e enviar para mikeregedit.glitch.me/send-message via WebSocket
app.post('/send-message', (req, res) => {
    const { title, message } = req.body;

    const ws = new WebSocket('wss://mikeregedit.glitch.me/send-message');

    ws.on('open', () => {
        const data = JSON.stringify({ title, message });
        ws.send(data, (err) => {
            if (err) {
                console.error('Erro ao enviar a mensagem via WebSocket:', err.message);
                res.status(500).json({ success: false, message: 'Erro ao enviar a mensagem via WebSocket' });
            } else {
                res.json({ success: true, message: 'Mensagem enviada com sucesso via WebSocket!' });
            }
        });
    });

    ws.on('message', (data) => {
        console.log('Received:', data.toString());
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });

    ws.on('error', (error) => {
        console.error('Erro na conexão WebSocket:', error.message);
        res.status(500).json({ success: false, message: 'Erro na conexão WebSocket' });
    });
});

app.get('/api/package/online-count', async (req, res) => {
    const token = 'tXqLZmcrIw1GwYatWl1EJjCRHVNHRoW4augNMEF5oxxH8e1Tm7akuqPpdM33CLltimwcintn6lE3/b0RvthH';
    try {
        const [rows] = await pool.query('SELECT id, online FROM packages WHERE token = ?', [token]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Package not found' });
        }
        res.json({ id: rows[0].id, online: rows[0].online });
    } catch (error) {
        console.error('Failed to get online count:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/permissions', ensureAuthenticated, async (req, res) => {
  try {
      const { username } = req.body;  // Mudança: Pegar o username do corpo da requisição
      const {
          canCreateKeys,
          canResetAnyKey,
          canRemoveAnyKey,
          canViewAnyKey,
          canModifyCredits,
          canViewAdmins,
          canCreateAdmins,
          canViewPackages  // Adicionado para manipular a permissão can_view_packages
      } = req.body;

      // Atualizar as permissões do vendedor
      const updateQuery = `
          UPDATE sellers
          SET can_create_keys = ?,
              can_reset_any_key = ?,
              can_remove_any_key = ?,
              can_view_any_key = ?,
              can_modify_credits = ?,
              can_view_admins = ?,
              can_create_admins = ?,
              can_view_packages = ?  -- Atualização da permissão can_view_packages
          WHERE username = ?
      `;
      await req.pool.query(updateQuery, [
          canCreateKeys || 0,
          canResetAnyKey || 0,
          canRemoveAnyKey || 0,
          canViewAnyKey || 0,
          canModifyCredits || 0,
          canViewAdmins || 0,
          canCreateAdmins || 0,
          canViewPackages || 0,  // Incluir a permissão can_view_packages no array de parâmetros
          username  // Mudança: Usar o username do corpo da requisição
      ]);

      res.json({ success: true });
  } catch (error) {
      console.error('Erro ao salvar permissões:', error);
      res.status(500).send('Erro ao salvar permissões');
  }
});




// Inicie o servidor
const port = process.env.PORT || 3000;

async function startServer() {
  await connectToDatabase();
  app.listen(port, () => {
    console.log(`Servidor está ouvindo na porta ${port}`);
  });
}

startServer();