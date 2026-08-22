document.addEventListener('DOMContentLoaded', () => {
  popularCategorias();
  popularSelectMovProduto();
  renderTabelaProdutos();
  renderTabelaMovimentacoes();

  document.getElementById('btn-novo-produto').addEventListener('click', abrirNovoProduto);
  document.getElementById('btn-salvar-produto').addEventListener('click', salvarProduto);
  document.getElementById('btn-nova-mov').addEventListener('click', () => {
    document.getElementById('form-mov').reset();
    limparErrosMov();
    openModal('modal-mov');
  });
  document.getElementById('btn-salvar-mov').addEventListener('click', salvarMovimentacao);

  document.getElementById('busca-produto').addEventListener('input', renderTabelaProdutos);
  document.getElementById('filtro-categoria').addEventListener('change', renderTabelaProdutos);
  document.getElementById('filtro-estoque').addEventListener('change', renderTabelaProdutos);
  document.getElementById('ordenar-produto').addEventListener('change', renderTabelaProdutos);
});

function popularCategorias() {
  const categorias = [...new Set(DB.get('produtos').map(p => p.categoria))].sort();
  const sel = document.getElementById('filtro-categoria');
  categorias.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });
}

function popularSelectMovProduto() {
  const sel = document.getElementById('mov-produto');
  DB.get('produtos').forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = `${p.nome} (${p.estoqueAtual} un.)`;
    sel.appendChild(opt);
  });
}

function renderTabelaProdutos() {
  const busca = document.getElementById('busca-produto').value.trim().toLowerCase();
  const categoria = document.getElementById('filtro-categoria').value;
  const nivel = document.getElementById('filtro-estoque').value;
  const ordenar = document.getElementById('ordenar-produto').value;

  let produtos = DB.get('produtos').filter(p => {
    const matchBusca = !busca || p.nome.toLowerCase().includes(busca) || p.codigo.toLowerCase().includes(busca);
    const matchCategoria = !categoria || p.categoria === categoria;
    let matchNivel = true;
    if (nivel === 'normal') matchNivel = p.estoqueAtual > p.estoqueMinimo;
    if (nivel === 'baixo') matchNivel = p.estoqueAtual > 0 && p.estoqueAtual <= p.estoqueMinimo;
    if (nivel === 'zero') matchNivel = p.estoqueAtual <= 0;
    return matchBusca && matchCategoria && matchNivel;
  });

  const sorters = {
    'nome': (a, b) => a.nome.localeCompare(b.nome),
    'estoque-asc': (a, b) => a.estoqueAtual - b.estoqueAtual,
    'estoque-desc': (a, b) => b.estoqueAtual - a.estoqueAtual,
    'preco-asc': (a, b) => a.precoVenda - b.precoVenda,
    'preco-desc': (a, b) => b.precoVenda - a.precoVenda
  };
  produtos.sort(sorters[ordenar] || sorters['nome']);

  const tbody = document.getElementById('tbl-produtos');
  if (produtos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="ic">📦</div>Nenhum produto encontrado.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = produtos.map(p => {
    const st = getProdutoStatus(p);
    return `
      <tr>
        <td class="mono">${escapeHtml(p.codigo)}</td>
        <td>${escapeHtml(p.nome)}</td>
        <td>${escapeHtml(p.categoria)}</td>
        <td class="mono">${formatBRL(p.precoVenda)}</td>
        <td class="mono">${p.estoqueAtual}</td>
        <td class="mono">${p.estoqueMinimo}</td>
        <td><span class="badge ${st.cls}">${st.label}</span></td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-icon" title="Editar" onclick="editarProduto('${p.id}')">✏️</button>
            <button class="btn btn-ghost btn-icon" title="Excluir" onclick="excluirProduto('${p.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderTabelaMovimentacoes() {
  const produtos = DB.get('produtos');
  const movs = [...DB.get('movimentacoes')].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 30);
  const tbody = document.getElementById('tbl-movimentacoes');

  if (movs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="ic">🔄</div>Nenhuma movimentação registrada.</div></td></tr>`;
    return;
  }

  const tipoBadge = { 'Entrada': 'badge-success', 'Saída': 'badge-danger', 'Ajuste': 'badge-info' };

  tbody.innerHTML = movs.map(m => {
    const produto = produtos.find(p => p.id === m.produtoId);
    return `
      <tr>
        <td>${escapeHtml(produto ? produto.nome : '—')}</td>
        <td><span class="badge ${tipoBadge[m.tipo] || 'badge-muted'}">${m.tipo}</span></td>
        <td class="mono">${m.quantidade}</td>
        <td>${formatDateTimeBR(m.data)}</td>
        <td>${escapeHtml(m.motivo)}</td>
      </tr>
    `;
  }).join('');
}

/* ---------- Produto: novo / editar / excluir ---------- */
function abrirNovoProduto() {
  document.getElementById('form-produto').reset();
  document.getElementById('produto-id').value = '';
  document.getElementById('modal-produto-titulo').textContent = 'Novo Produto';
  limparErrosProduto();
  openModal('modal-produto');
}

function editarProduto(id) {
  const p = DB.findById('produtos', id);
  if (!p) return;
  document.getElementById('form-produto').reset();
  limparErrosProduto();
  document.getElementById('produto-id').value = p.id;
  document.getElementById('modal-produto-titulo').textContent = 'Editar Produto';
  document.getElementById('produto-codigo').value = p.codigo;
  document.getElementById('produto-nome').value = p.nome;
  document.getElementById('produto-categoria').value = p.categoria;
  document.getElementById('produto-marca').value = p.marca || '';
  document.getElementById('produto-unidade').value = p.unidade;
  document.getElementById('produto-fornecedor').value = p.fornecedor || '';
  document.getElementById('produto-preco-custo').value = p.precoCusto;
  document.getElementById('produto-preco-venda').value = p.precoVenda;
  document.getElementById('produto-estoque-atual').value = p.estoqueAtual;
  document.getElementById('produto-estoque-minimo').value = p.estoqueMinimo;
  document.getElementById('produto-descricao').value = p.descricao || '';
  openModal('modal-produto');
}

function limparErrosProduto() {
  ['produto-codigo', 'produto-nome', 'produto-preco-custo', 'produto-preco-venda', 'produto-estoque-atual', 'produto-estoque-minimo'].forEach(id => {
    document.getElementById('err-' + id)?.classList.remove('show');
    document.getElementById(id).parentElement.classList.remove('error');
  });
}

function salvarProduto() {
  limparErrosProduto();
  let valido = true;
  const marcarErro = (id) => {
    document.getElementById('err-' + id).classList.add('show');
    document.getElementById(id).parentElement.classList.add('error');
    valido = false;
  };

  const codigo = document.getElementById('produto-codigo').value.trim();
  const nome = document.getElementById('produto-nome').value.trim();
  const categoria = document.getElementById('produto-categoria').value.trim() || 'Geral';
  const marca = document.getElementById('produto-marca').value.trim();
  const unidade = document.getElementById('produto-unidade').value;
  const fornecedor = document.getElementById('produto-fornecedor').value.trim();
  const precoCusto = parseFloat(document.getElementById('produto-preco-custo').value);
  const precoVenda = parseFloat(document.getElementById('produto-preco-venda').value);
  const estoqueAtual = parseInt(document.getElementById('produto-estoque-atual').value, 10);
  const estoqueMinimo = parseInt(document.getElementById('produto-estoque-minimo').value, 10);
  const descricao = document.getElementById('produto-descricao').value.trim();
  const idExistente = document.getElementById('produto-id').value;

  if (!codigo) marcarErro('produto-codigo');
  if (!nome) marcarErro('produto-nome');
  if (isNaN(precoCusto) || precoCusto < 0) marcarErro('produto-preco-custo');
  if (isNaN(precoVenda) || precoVenda < 0) marcarErro('produto-preco-venda');
  if (isNaN(estoqueAtual) || estoqueAtual < 0) marcarErro('produto-estoque-atual');
  if (isNaN(estoqueMinimo) || estoqueMinimo < 0) marcarErro('produto-estoque-minimo');

  if (!valido) {
    showToast('Corrija os campos destacados antes de salvar.', 'error');
    return;
  }

  const dados = { codigo, nome, categoria, marca, unidade, fornecedor, precoCusto, precoVenda, estoqueAtual, estoqueMinimo, descricao };

  if (idExistente) {
    DB.update('produtos', idExistente, dados);
    showToast('Produto atualizado!', 'success');
  } else {
    DB.add('produtos', dados);
    showToast('Produto cadastrado com sucesso!', 'success');
  }

  closeModal('modal-produto');
  location.reload();
}

function excluirProduto(id) {
  const p = DB.findById('produtos', id);
  if (!p) return;
  if (!confirm(`Deseja realmente excluir o produto "${p.nome}"?`)) return;
  DB.remove('produtos', id);
  showToast('Produto excluído!', 'warning');
  renderTabelaProdutos();
}

/* ---------- Movimentações ---------- */
function limparErrosMov() {
  ['mov-produto', 'mov-quantidade', 'mov-motivo'].forEach(id => {
    document.getElementById('err-' + id).classList.remove('show');
    document.getElementById(id).parentElement.classList.remove('error');
  });
}

function salvarMovimentacao() {
  limparErrosMov();
  let valido = true;
  const marcarErro = (id) => {
    document.getElementById('err-' + id).classList.add('show');
    document.getElementById(id).parentElement.classList.add('error');
    valido = false;
  };

  const produtoId = document.getElementById('mov-produto').value;
  const tipo = document.getElementById('mov-tipo').value;
  const quantidade = parseInt(document.getElementById('mov-quantidade').value, 10);
  const motivo = document.getElementById('mov-motivo').value.trim();

  if (!produtoId) marcarErro('mov-produto');
  if (isNaN(quantidade) || quantidade <= 0) marcarErro('mov-quantidade');
  if (!motivo) marcarErro('mov-motivo');

  if (!valido) {
    showToast('Corrija os campos destacados antes de registrar.', 'error');
    return;
  }

  const delta = tipo === 'Saída' ? -quantidade : quantidade;
  const ok = aplicarDeltaEstoque(produtoId, delta, tipo, motivo);
  if (!ok) {
    showToast('Estoque insuficiente para essa movimentação de saída!', 'error');
    return;
  }

  showToast('Movimentação registrada com sucesso!', 'success');
  closeModal('modal-mov');
  location.reload();
}