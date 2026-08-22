/* =========================================================
   DistribuiPro — Núcleo do sistema (app.js)
   Storage, utilidades, autenticação simulada, seed de dados,
   toasts, modais e sidebar responsiva.
   ========================================================= */

const DB_PREFIX = 'distribuipro_';

const STATUS_PEDIDO = ['Pendente', 'Confirmado', 'Em separação', 'Enviado', 'Entregue', 'Cancelado'];
const STATUS_ENTREGA = ['Aguardando separação', 'Separado', 'Saiu para entrega', 'Entregue', 'Não entregue', 'Cancelado'];
const STATUS_COMISSAO = ['Pendente', 'A pagar', 'Pago'];

/* ---------------------------------------------------------
   Camada de armazenamento (localStorage)
   --------------------------------------------------------- */
const DB = {
  get(key) {
    try {
      const raw = localStorage.getItem(DB_PREFIX + key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Erro ao ler storage', key, e);
      return [];
    }
  },
  set(key, value) {
    localStorage.setItem(DB_PREFIX + key, JSON.stringify(value));
  },
  add(key, obj) {
    const list = DB.get(key);
    if (!obj.id) obj.id = genId();
    list.push(obj);
    DB.set(key, list);
    return obj;
  },
  update(key, id, patch) {
    const list = DB.get(key);
    const idx = list.findIndex(i => i.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    DB.set(key, list);
    return list[idx];
  },
  remove(key, id) {
    const list = DB.get(key).filter(i => i.id !== id);
    DB.set(key, list);
  },
  findById(key, id) {
    return DB.get(key).find(i => i.id === id) || null;
  }
};

function genId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/* ---------------------------------------------------------
   Formatação (padrão brasileiro)
   --------------------------------------------------------- */
function formatBRL(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDateBR(iso) {
  if (!iso) return '-';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}
function formatDateTimeBR(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return formatDateBR(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function formatPercent(v) {
  return Number(v || 0).toLocaleString('pt-BR') + '%';
}
function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function monthPeriod(iso) {
  return (iso || todayISO()).slice(0, 7); // YYYY-MM
}
function monthLabel(period) {
  const [y, m] = period.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return meses[parseInt(m, 10) - 1] + '/' + y;
}
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/* ---------------------------------------------------------
   Autenticação simulada (somente frontend)
   --------------------------------------------------------- */
const AUTH_EMAIL = 'admin@distribuipro.com';
const AUTH_SENHA = '123456';

function isLoggedIn() {
  return !!localStorage.getItem(DB_PREFIX + 'session');
}
function login(email, senha) {
  if (email.trim().toLowerCase() === AUTH_EMAIL && senha === AUTH_SENHA) {
    localStorage.setItem(DB_PREFIX + 'session', JSON.stringify({ email, ts: Date.now() }));
    return true;
  }
  return false;
}
function logout() {
  localStorage.removeItem(DB_PREFIX + 'session');
  window.location.href = 'login.html';
}
function requireAuth() {
  const path = window.location.pathname.split('/').pop();
  if (path === 'login.html' || path === '') return;
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
  }
}
function currentUserLabel() {
  try {
    const s = JSON.parse(localStorage.getItem(DB_PREFIX + 'session'));
    return s && s.email ? s.email : 'admin@distribuipro.com';
  } catch (e) {
    return 'admin@distribuipro.com';
  }
}

/* ---------------------------------------------------------
   Toasts
   --------------------------------------------------------- */
function showToast(msg, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/* ---------------------------------------------------------
   Modais
   --------------------------------------------------------- */
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('open');
  document.body.classList.add('modal-open');
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('open');
  document.body.classList.remove('modal-open');
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.open').forEach(m => closeModal(m.id));
  }
});
document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal') && e.target.classList.contains('open')) {
    closeModal(e.target.id);
  }
});

/* ---------------------------------------------------------
   Sidebar (mobile) + destaque do item ativo
   --------------------------------------------------------- */
function initShell() {
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (toggle && sidebar && overlay) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('show');
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
    sidebar.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    }));
  }
  const userEl = document.getElementById('sidebar-user-email');
  if (userEl) userEl.textContent = currentUserLabel();
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  const dateEl = document.getElementById('pill-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

/* ---------------------------------------------------------
   Regras de negócio compartilhadas
   --------------------------------------------------------- */
function getProdutoStatus(p) {
  if (p.estoqueAtual <= 0) return { label: 'Sem estoque', cls: 'badge-danger', dot: '🔴' };
  if (p.estoqueAtual <= p.estoqueMinimo) return { label: 'Estoque baixo', cls: 'badge-amber', dot: '🟡' };
  return { label: 'Normal', cls: 'badge-teal', dot: '🟢' };
}

function registrarMovimentacao(produtoId, tipo, quantidade, motivo) {
  DB.add('movimentacoes', {
    produtoId, tipo, quantidade, motivo,
    data: new Date().toISOString()
  });
}

// Aplica variação de estoque; impede estoque negativo. Retorna true/false.
function aplicarDeltaEstoque(produtoId, delta, tipo, motivo) {
  const produto = DB.findById('produtos', produtoId);
  if (!produto) return false;
  const novo = (produto.estoqueAtual || 0) + delta;
  if (novo < 0) return false;
  DB.update('produtos', produtoId, { estoqueAtual: novo });
  registrarMovimentacao(produtoId, tipo, Math.abs(delta), motivo);
  return true;
}

function statusIndexPedido(status) {
  return STATUS_PEDIDO.indexOf(status);
}

// Baixa o estoque dos itens do pedido (uma única vez por pedido)
function baixarEstoquePedido(pedido) {
  for (const item of pedido.itens) {
    const produto = DB.findById('produtos', item.produtoId);
    if (!produto || produto.estoqueAtual < item.quantidade) {
      return { ok: false, produto: produto ? produto.nome : '?' };
    }
  }
  for (const item of pedido.itens) {
    aplicarDeltaEstoque(item.produtoId, -item.quantidade, 'Saída', 'Baixa automática — Pedido ' + pedido.numero);
  }
  return { ok: true };
}

// Devolve estoque de um pedido cancelado (se já havia sido baixado)
function devolverEstoquePedido(pedido) {
  for (const item of pedido.itens) {
    aplicarDeltaEstoque(item.produtoId, item.quantidade, 'Entrada', 'Devolução — Pedido ' + pedido.numero + ' cancelado');
  }
}

function estoqueDisponivel(produtoId) {
  const p = DB.findById('produtos', produtoId);
  return p ? p.estoqueAtual : 0;
}

// Total vendido de um vendedor (pedidos não pendentes/cancelados), opcionalmente filtrado por período (YYYY-MM)
function getVendasVendedor(vendedorId, periodo = null) {
  const pedidos = DB.get('pedidos').filter(p =>
    p.vendedorId === vendedorId &&
    p.status !== 'Pendente' && p.status !== 'Cancelado' &&
    (!periodo || monthPeriod(p.data) === periodo)
  );
  const total = pedidos.reduce((s, p) => s + p.total, 0);
  return { total, quantidade: pedidos.length };
}

function getNextPedidoNumero() {
  const pedidos = DB.get('pedidos');
  const max = pedidos.reduce((m, p) => {
    const n = parseInt(String(p.numero).replace(/\D/g, ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 1000);
  return 'PED-' + (max + 1);
}

/* ---------------------------------------------------------
   Dados demonstrativos (seed) — gerados apenas uma vez
   --------------------------------------------------------- */
function seedIfEmpty() {
  if (localStorage.getItem(DB_PREFIX + 'seeded')) return;

  const produtos = [
    { id: genId(), codigo: 'PRD-001', nome: 'Refrigerante Cola 2L', categoria: 'Bebidas', marca: 'Fribom', unidade: 'UN', precoCusto: 4.20, precoVenda: 7.90, estoqueAtual: 320, estoqueMinimo: 60, fornecedor: 'Distribuidora Fribom Ltda', descricao: 'Refrigerante sabor cola, garrafa 2 litros.' },
    { id: genId(), codigo: 'PRD-002', nome: 'Água Mineral 500ml', categoria: 'Bebidas', marca: 'Serra Azul', unidade: 'UN', precoCusto: 0.80, precoVenda: 1.90, estoqueAtual: 40, estoqueMinimo: 100, fornecedor: 'Serra Azul Águas', descricao: 'Água mineral sem gás, embalagem PET.' },
    { id: genId(), codigo: 'PRD-003', nome: 'Cerveja Pilsen Lata 350ml', categoria: 'Bebidas', marca: 'Águia Dourada', unidade: 'UN', precoCusto: 2.60, precoVenda: 4.50, estoqueAtual: 500, estoqueMinimo: 120, fornecedor: 'Cervejaria Águia Dourada', descricao: 'Cerveja pilsen, lata 350ml, caixa com 12.' },
    { id: genId(), codigo: 'PRD-004', nome: 'Arroz Branco Tipo 1 5kg', categoria: 'Mercearia', marca: 'Fazenda Bela Vista', unidade: 'PCT', precoCusto: 16.00, precoVenda: 24.90, estoqueAtual: 150, estoqueMinimo: 40, fornecedor: 'Cerealista Bela Vista', descricao: 'Arroz branco tipo 1, pacote de 5kg.' },
    { id: genId(), codigo: 'PRD-005', nome: 'Feijão Carioca 1kg', categoria: 'Mercearia', marca: 'Vale Verde', unidade: 'PCT', precoCusto: 6.10, precoVenda: 9.80, estoqueAtual: 8, estoqueMinimo: 30, fornecedor: 'Cerealista Vale Verde', descricao: 'Feijão carioca tipo 1, pacote de 1kg.' },
    { id: genId(), codigo: 'PRD-006', nome: 'Óleo de Soja 900ml', categoria: 'Mercearia', marca: 'Girassol Ouro', unidade: 'UN', precoCusto: 5.30, precoVenda: 8.40, estoqueAtual: 210, estoqueMinimo: 50, fornecedor: 'Óleos Girassol Ouro', descricao: 'Óleo de soja refinado, garrafa 900ml.' },
    { id: genId(), codigo: 'PRD-007', nome: 'Detergente Neutro 500ml', categoria: 'Limpeza', marca: 'Bril Clean', unidade: 'UN', precoCusto: 1.10, precoVenda: 2.30, estoqueAtual: 0, estoqueMinimo: 60, fornecedor: 'Bril Clean Química', descricao: 'Detergente líquido neutro, 500ml.' },
    { id: genId(), codigo: 'PRD-008', nome: 'Sabão em Pó 1kg', categoria: 'Limpeza', marca: 'Espuma Rica', unidade: 'PCT', precoCusto: 7.90, precoVenda: 12.50, estoqueAtual: 95, estoqueMinimo: 25, fornecedor: 'Espuma Rica Indústria', descricao: 'Sabão em pó multiuso, caixa 1kg.' },
    { id: genId(), codigo: 'PRD-009', nome: 'Papel Higiênico 12 rolos', categoria: 'Higiene', marca: 'Suavetex', unidade: 'PCT', precoCusto: 14.20, precoVenda: 21.90, estoqueAtual: 60, estoqueMinimo: 20, fornecedor: 'Suavetex Papéis', descricao: 'Papel higiênico folha dupla, pacote 12 rolos.' },
    { id: genId(), codigo: 'PRD-010', nome: 'Biscoito Recheado 140g', categoria: 'Mercearia', marca: 'Doce Trigo', unidade: 'UN', precoCusto: 1.80, precoVenda: 3.20, estoqueAtual: 18, estoqueMinimo: 40, fornecedor: 'Doce Trigo Alimentos', descricao: 'Biscoito recheado sabor chocolate, 140g.' },
    { id: genId(), codigo: 'PRD-011', nome: 'Café Torrado e Moído 500g', categoria: 'Mercearia', marca: 'Serra Alta', unidade: 'PCT', precoCusto: 9.80, precoVenda: 14.90, estoqueAtual: 130, estoqueMinimo: 30, fornecedor: 'Torrefação Serra Alta', descricao: 'Café torrado e moído tradicional, 500g.' },
    { id: genId(), codigo: 'PRD-012', nome: 'Leite Longa Vida 1L', categoria: 'Laticínios', marca: 'Pradaria', unidade: 'UN', precoCusto: 3.60, precoVenda: 5.40, estoqueAtual: 240, estoqueMinimo: 80, fornecedor: 'Laticínios Pradaria', descricao: 'Leite UHT integral, caixa 1 litro.' }
  ];

  const clientes = [
    { id: genId(), nome: 'Mercadinho Bom Preço Ltda', documento: '12.345.678/0001-90', telefone: '(49) 3333-1122', whatsapp: '(49) 99911-2233', email: 'contato@bompreco.com.br', cep: '89500-000', endereco: 'Rua das Palmeiras', numero: '120', bairro: 'Centro', cidade: 'Caçador', estado: 'SC', observacoes: 'Cliente antigo, pagamento em dia.' },
    { id: genId(), nome: 'Padaria Pão Nosso', documento: '23.456.789/0001-11', telefone: '(49) 3322-4455', whatsapp: '(49) 99822-4455', email: 'padaria.paonosso@gmail.com', cep: '89500-100', endereco: 'Av. Getúlio Vargas', numero: '540', bairro: 'São Cristóvão', cidade: 'Caçador', estado: 'SC', observacoes: 'Prefere entregas pela manhã.' },
    { id: genId(), nome: 'Distribuidora Vale do Rio', documento: '34.567.890/0001-22', telefone: '(49) 3311-7788', whatsapp: '(49) 99733-8899', email: 'compras@valedorio.com.br', cep: '89500-200', endereco: 'Rod. BR-153', numero: 'Km 12', bairro: 'Industrial', cidade: 'Caçador', estado: 'SC', observacoes: 'Compras em grande volume mensal.' },
    { id: genId(), nome: 'Mercado Família Souza', documento: '45.678.901/0001-33', telefone: '(49) 3344-5566', whatsapp: '(49) 99644-5566', email: 'familiasouza@hotmail.com', cep: '89500-300', endereco: 'Rua XV de Novembro', numero: '88', bairro: 'Vila Nova', cidade: 'Caçador', estado: 'SC', observacoes: '' },
    { id: genId(), nome: 'Restaurante Sabor Caseiro', documento: '56.789.012/0001-44', telefone: '(49) 3355-6677', whatsapp: '(49) 99555-6677', email: 'contato@saborcaseiro.com.br', cep: '89500-400', endereco: 'Rua Barão do Rio Branco', numero: '210', bairro: 'Centro', cidade: 'Caçador', estado: 'SC', observacoes: 'Solicita nota fiscal em todos os pedidos.' },
    { id: genId(), nome: 'Bar do Zé', documento: '67.890.123/0001-55', telefone: '(49) 3366-7788', whatsapp: '(49) 99466-7788', email: 'bardoze@gmail.com', cep: '89500-500', endereco: 'Rua das Acácias', numero: '45', bairro: 'Jardim Europa', cidade: 'Caçador', estado: 'SC', observacoes: 'Entrega preferencialmente sexta-feira.' },
    { id: genId(), nome: 'Supermercado Estrela', documento: '78.901.234/0001-66', telefone: '(49) 3377-8899', whatsapp: '(49) 99377-8899', email: 'financeiro@superestrela.com.br', cep: '89500-600', endereco: 'Av. Marechal Deodoro', numero: '900', bairro: 'Centro', cidade: 'Caçador', estado: 'SC', observacoes: 'Maior cliente em volume de compras.' },
    { id: genId(), nome: 'Lanchonete Ponto Certo', documento: '89.012.345/0001-77', telefone: '(49) 3388-9900', whatsapp: '(49) 99288-9900', email: 'pontocerto@outlook.com', cep: '89500-700', endereco: 'Rua Duque de Caxias', numero: '33', bairro: 'São Cristóvão', cidade: 'Caçador', estado: 'SC', observacoes: '' }
  ];

  const vendedores = [
    { id: genId(), nome: 'Carlos Eduardo Ramos', cpf: '123.456.789-01', telefone: '(49) 99911-0001', email: 'carlos.ramos@distribuipro.com', dataEntrada: '2021-03-10', percentualComissao: 3, status: 'Ativo' },
    { id: genId(), nome: 'Fernanda Lopes Martins', cpf: '234.567.890-12', telefone: '(49) 99911-0002', email: 'fernanda.martins@distribuipro.com', dataEntrada: '2020-07-22', percentualComissao: 3.5, status: 'Ativo' },
    { id: genId(), nome: 'Rodrigo Alves Pereira', cpf: '345.678.901-23', telefone: '(49) 99911-0003', email: 'rodrigo.pereira@distribuipro.com', dataEntrada: '2022-01-15', percentualComissao: 2.5, status: 'Ativo' },
    { id: genId(), nome: 'Juliana Costa Silveira', cpf: '456.789.012-34', telefone: '(49) 99911-0004', email: 'juliana.silveira@distribuipro.com', dataEntrada: '2019-11-05', percentualComissao: 4, status: 'Ativo' },
    { id: genId(), nome: 'Marcos Vinícius Tavares', cpf: '567.890.123-45', telefone: '(49) 99911-0005', email: 'marcos.tavares@distribuipro.com', dataEntrada: '2023-05-30', percentualComissao: 3, status: 'Inativo' }
  ];

  const clienteIds = clientes.map(c => c.id);
  const vendedorIds = vendedores.map(v => v.id);
  const produtoIds = produtos.map(p => p.id);

  function pick(arr, i) { return arr[i % arr.length]; }
  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function isoDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  const statusCiclo = ['Pendente', 'Confirmado', 'Em separação', 'Enviado', 'Entregue', 'Entregue', 'Entregue', 'Confirmado', 'Cancelado'];
  const formas = ['Dinheiro', 'PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Boleto'];

  const pedidos = [];
  for (let i = 0; i < 15; i++) {
    const cliente = pick(clienteIds, i);
    const vendedor = pick(vendedorIds, i);
    const status = pick(statusCiclo, i);
    const diasAtras = rand(0, 12);
    const nItens = rand(1, 3);
    const itens = [];
    const usados = new Set();
    for (let j = 0; j < nItens; j++) {
      let prodId = pick(produtoIds, i + j * 3);
      if (usados.has(prodId)) prodId = pick(produtoIds, i + j * 3 + 5);
      usados.add(prodId);
      const produto = produtos.find(p => p.id === prodId);
      const quantidade = rand(2, 12);
      itens.push({ produtoId: prodId, quantidade, precoUnitario: produto.precoVenda });
    }
    const subtotal = itens.reduce((s, it) => s + it.quantidade * it.precoUnitario, 0);
    const desconto = Math.round(subtotal * (rand(0, 8) / 100) * 100) / 100;
    const total = Math.round((subtotal - desconto) * 100) / 100;
    const pedido = {
      id: genId(),
      numero: 'PED-' + (1001 + i),
      clienteId: cliente,
      vendedorId: vendedor,
      data: isoDaysAgo(diasAtras),
      itens,
      subtotal: Math.round(subtotal * 100) / 100,
      desconto,
      total,
      formaPagamento: pick(formas, i),
      observacoes: '',
      status,
      estoqueBaixado: status !== 'Pendente' && status !== 'Cancelado'
    };
    pedidos.push(pedido);
  }

  // Aplica baixa de estoque para pedidos já processados na seed
  for (const p of pedidos) {
    if (p.estoqueBaixado) {
      for (const item of p.itens) {
        const prod = produtos.find(pr => pr.id === item.produtoId);
        if (prod) prod.estoqueAtual = Math.max(0, prod.estoqueAtual - item.quantidade);
      }
    }
  }

  const movimentacoes = [
    { id: genId(), produtoId: produtoIds[0], tipo: 'Entrada', quantidade: 200, motivo: 'Compra de fornecedor', data: isoDaysAgo(9) + 'T09:00:00' },
    { id: genId(), produtoId: produtoIds[3], tipo: 'Entrada', quantidade: 100, motivo: 'Reposição mensal', data: isoDaysAgo(7) + 'T10:30:00' },
    { id: genId(), produtoId: produtoIds[4], tipo: 'Saída', quantidade: 15, motivo: 'Venda balcão', data: isoDaysAgo(5) + 'T14:00:00' },
    { id: genId(), produtoId: produtoIds[6], tipo: 'Ajuste', quantidade: 6, motivo: 'Produtos danificados no transporte', data: isoDaysAgo(3) + 'T11:15:00' },
    { id: genId(), produtoId: produtoIds[9], tipo: 'Saída', quantidade: 22, motivo: 'Venda balcão', data: isoDaysAgo(2) + 'T16:40:00' }
  ];

  const statusEntregaCiclo = ['Aguardando separação', 'Separado', 'Saiu para entrega', 'Entregue', 'Entregue', 'Não entregue', 'Entregue', 'Cancelado'];
  const responsaveis = ['João Batista (motorista)', 'Anderson Silva (motorista)', 'Paulo Henrique (motoboy)'];
  const entregasPedidos = pedidos.filter(p => p.status !== 'Pendente').slice(0, 8);
  const entregas = entregasPedidos.map((p, i) => {
    const cliente = clientes.find(c => c.id === p.clienteId);
    const status = pick(statusEntregaCiclo, i);
    return {
      id: genId(),
      pedidoId: p.id,
      clienteId: p.clienteId,
      endereco: `${cliente.endereco}, ${cliente.numero} - ${cliente.bairro}, ${cliente.cidade}/${cliente.estado}`,
      responsavel: pick(responsaveis, i),
      dataPrevista: p.data,
      dataEntrega: (status === 'Entregue') ? p.data : '',
      observacoes: '',
      status
    };
  });

  DB.set('produtos', produtos);
  DB.set('clientes', clientes);
  DB.set('vendedores', vendedores);
  DB.set('pedidos', pedidos);
  DB.set('movimentacoes', movimentacoes);
  DB.set('entregas', entregas);
  DB.set('comissoes', []);

  localStorage.setItem(DB_PREFIX + 'seeded', '1');
}

function statusBadge(status) {
  const map = {
    'Pendente': 'badge-amber',
    'Confirmado': 'badge-info',
    'Em separação': 'badge-info',
    'Enviado': 'badge-teal',
    'Entregue': 'badge-success',
    'Cancelado': 'badge-danger',
    'Aguardando separação': 'badge-amber',
    'Separado': 'badge-info',
    'Saiu para entrega': 'badge-teal',
    'Não entregue': 'badge-danger',
    'A pagar': 'badge-info',
    'Pago': 'badge-success',
    'Ativo': 'badge-success',
    'Inativo': 'badge-muted'
  };
  return `<span class="badge ${map[status] || 'badge-muted'}">${status}</span>`;
}

/* Executa verificações essenciais assim que o script carrega */
requireAuth();
seedIfEmpty();
document.addEventListener('DOMContentLoaded', initShell);