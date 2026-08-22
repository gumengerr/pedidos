let itemCounter = 0;

document.addEventListener('DOMContentLoaded', () => {
  popularFiltros();
  popularSelectsPedido();
  renderTabelaPedidos();

  document.getElementById('btn-novo-pedido').addEventListener('click', abrirNovoPedido);
  document.getElementById('btn-add-item').addEventListener('click', () => adicionarLinhaItem());
  document.getElementById('btn-salvar-pedido').addEventListener('click', salvarPedido);
  document.getElementById('btn-confirmar-status').addEventListener('click', confirmarNovoStatus);
  document.getElementById('pedido-desconto').addEventListener('input', recalcularTotais);

  document.getElementById('busca-pedido').addEventListener('input', renderTabelaPedidos);
  document.getElementById('filtro-status').addEventListener('change', renderTabelaPedidos);
  document.getElementById('filtro-vendedor').addEventListener('change', renderTabelaPedidos);
  document.getElementById('filtro-cliente').addEventListener('change', renderTabelaPedidos);
});

function popularFiltros() {
  const selStatus = document.getElementById('filtro-status');
  STATUS_PEDIDO.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    selStatus.appendChild(opt);
  });

  const vendedores = DB.get('vendedores');
  const selVendedor = document.getElementById('filtro-vendedor');
  vendedores.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id; opt.textContent = v.nome;
    selVendedor.appendChild(opt);
  });

  const clientes = DB.get('clientes');
  const selCliente = document.getElementById('filtro-cliente');
  clientes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.nome;
    selCliente.appendChild(opt);
  });
}

function popularSelectsPedido() {
  const selCliente = document.getElementById('pedido-cliente');
  DB.get('clientes').forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.nome;
    selCliente.appendChild(opt);
  });
  const selVendedor = document.getElementById('pedido-vendedor');
  DB.get('vendedores').filter(v => v.status === 'Ativo').forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id; opt.textContent = v.nome;
    selVendedor.appendChild(opt);
  });
}

function renderTabelaPedidos() {
  const busca = document.getElementById('busca-pedido').value.trim().toLowerCase();
  const fStatus = document.getElementById('filtro-status').value;
  const fVendedor = document.getElementById('filtro-vendedor').value;
  const fCliente = document.getElementById('filtro-cliente').value;

  const clientes = DB.get('clientes');
  const vendedores = DB.get('vendedores');
  const produtos = DB.get('produtos');

  let pedidos = [...DB.get('pedidos')].sort((a, b) => new Date(b.data) - new Date(a.data));

  pedidos = pedidos.filter(p => {
    const cliente = clientes.find(c => c.id === p.clienteId);
    const matchBusca = !busca || p.numero.toLowerCase().includes(busca) || (cliente && cliente.nome.toLowerCase().includes(busca));
    const matchStatus = !fStatus || p.status === fStatus;
    const matchVendedor = !fVendedor || p.vendedorId === fVendedor;
    const matchCliente = !fCliente || p.clienteId === fCliente;
    return matchBusca && matchStatus && matchVendedor && matchCliente;
  });

  const tbody = document.getElementById('tbl-pedidos');
  if (pedidos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="ic">🧾</div>Nenhum pedido encontrado.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = pedidos.map(p => {
    const cliente = clientes.find(c => c.id === p.clienteId);
    const vendedor = vendedores.find(v => v.id === p.vendedorId);
    const produtosResumo = p.itens.map(it => {
      const prod = produtos.find(pr => pr.id === it.produtoId);
      return prod ? `${prod.nome} (${it.quantidade})` : '';
    }).filter(Boolean).join(', ');

    return `
      <tr>
        <td class="mono">${p.numero}</td>
        <td>${formatDateBR(p.data)}</td>
        <td>${escapeHtml(cliente ? cliente.nome : '—')}</td>
        <td>${escapeHtml(vendedor ? vendedor.nome : '—')}</td>
        <td style="max-width:220px;" title="${escapeHtml(produtosResumo)}">${escapeHtml(produtosResumo.length > 40 ? produtosResumo.slice(0, 40) + '…' : produtosResumo)}</td>
        <td class="mono">${formatBRL(p.total)}</td>
        <td>${statusBadge(p.status)}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-icon" title="Visualizar" onclick="visualizarPedido('${p.id}')">👁️</button>
            <button class="btn btn-ghost btn-icon" title="Editar" onclick="editarPedido('${p.id}')">✏️</button>
            <button class="btn btn-ghost btn-icon" title="Alterar status" onclick="abrirStatusPedido('${p.id}')">🔄</button>
            <button class="btn btn-ghost btn-icon" title="Excluir" onclick="excluirPedido('${p.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/* ---------- Formulário de pedido (novo / editar) ---------- */
function abrirNovoPedido() {
  document.getElementById('form-pedido').reset();
  document.getElementById('pedido-id').value = '';
  document.getElementById('modal-pedido-titulo').textContent = 'Novo Pedido';
  document.getElementById('pedido-data').value = todayISO();
  document.getElementById('pedido-desconto').value = 0;
  document.getElementById('itens-pedido').innerHTML = '';
  itemCounter = 0;
  limparErrosPedido();
  adicionarLinhaItem();
  recalcularTotais();
  openModal('modal-pedido');
}

function editarPedido(id) {
  const pedido = DB.findById('pedidos', id);
  if (!pedido) return;
  document.getElementById('form-pedido').reset();
  limparErrosPedido();
  document.getElementById('pedido-id').value = pedido.id;
  document.getElementById('modal-pedido-titulo').textContent = 'Editar Pedido ' + pedido.numero;
  document.getElementById('pedido-cliente').value = pedido.clienteId;
  document.getElementById('pedido-vendedor').value = pedido.vendedorId;
  document.getElementById('pedido-data').value = pedido.data;
  document.getElementById('pedido-forma-pagamento').value = pedido.formaPagamento;
  document.getElementById('pedido-desconto').value = pedido.desconto;
  document.getElementById('pedido-observacoes').value = pedido.observacoes || '';

  document.getElementById('itens-pedido').innerHTML = '';
  itemCounter = 0;
  pedido.itens.forEach(it => adicionarLinhaItem(it));
  recalcularTotais();
  openModal('modal-pedido');
}

function adicionarLinhaItem(item = null) {
  itemCounter++;
  const rowId = 'item-row-' + itemCounter;
  const produtos = DB.get('produtos');
  const wrapper = document.createElement('div');
  wrapper.className = 'item-row';
  wrapper.id = rowId;

  const options = produtos.map(p => `<option value="${p.id}" data-preco="${p.precoVenda}" data-estoque="${p.estoqueAtual}">${escapeHtml(p.nome)} (${p.estoqueAtual} un.)</option>`).join('');

  wrapper.innerHTML = `
    <select class="item-produto">
      <option value="">Selecione um produto</option>
      ${options}
    </select>
    <input type="number" class="item-qtd" min="1" value="${item ? item.quantidade : 1}" placeholder="Qtd.">
    <input type="number" class="item-preco" min="0" step="0.01" value="${item ? item.precoUnitario : ''}" placeholder="Preço">
    <span class="mono item-subtotal">R$ 0,00</span>
    <button type="button" class="btn btn-ghost btn-icon" title="Remover">🗑️</button>
  `;

  document.getElementById('itens-pedido').appendChild(wrapper);

  const selectProduto = wrapper.querySelector('.item-produto');
  const inputQtd = wrapper.querySelector('.item-qtd');
  const inputPreco = wrapper.querySelector('.item-preco');
  const btnRemover = wrapper.querySelector('button');

  if (item) selectProduto.value = item.produtoId;

  selectProduto.addEventListener('change', () => {
    const opt = selectProduto.selectedOptions[0];
    if (opt && opt.dataset.preco) inputPreco.value = opt.dataset.preco;
    recalcularTotais();
  });
  inputQtd.addEventListener('input', recalcularTotais);
  inputPreco.addEventListener('input', recalcularTotais);
  btnRemover.addEventListener('click', () => {
    wrapper.remove();
    recalcularTotais();
  });

  recalcularTotais();
}

function lerItensFormulario() {
  const linhas = document.querySelectorAll('#itens-pedido .item-row');
  const itens = [];
  linhas.forEach(linha => {
    const produtoId = linha.querySelector('.item-produto').value;
    const quantidade = parseFloat(linha.querySelector('.item-qtd').value) || 0;
    const precoUnitario = parseFloat(linha.querySelector('.item-preco').value) || 0;
    if (produtoId && quantidade > 0) {
      itens.push({ produtoId, quantidade, precoUnitario });
    }
  });
  return itens;
}

function recalcularTotais() {
  const linhas = document.querySelectorAll('#itens-pedido .item-row');
  let subtotal = 0;
  linhas.forEach(linha => {
    const qtd = parseFloat(linha.querySelector('.item-qtd').value) || 0;
    const preco = parseFloat(linha.querySelector('.item-preco').value) || 0;
    const st = qtd * preco;
    subtotal += st;
    linha.querySelector('.item-subtotal').textContent = formatBRL(st);
  });
  const desconto = parseFloat(document.getElementById('pedido-desconto').value) || 0;
  const total = Math.max(0, subtotal - desconto);
  document.getElementById('totais-subtotal').textContent = formatBRL(subtotal);
  document.getElementById('totais-desconto').textContent = formatBRL(desconto);
  document.getElementById('totais-total').textContent = formatBRL(total);
}

function limparErrosPedido() {
  ['pedido-cliente', 'pedido-vendedor'].forEach(id => {
    document.getElementById('err-' + id).classList.remove('show');
    document.getElementById(id).parentElement.classList.remove('error');
  });
  document.getElementById('err-pedido-itens').classList.remove('show');
}

function salvarPedido() {
  limparErrosPedido();
  let valido = true;

  const clienteId = document.getElementById('pedido-cliente').value;
  const vendedorId = document.getElementById('pedido-vendedor').value;
  const data = document.getElementById('pedido-data').value || todayISO();
  const formaPagamento = document.getElementById('pedido-forma-pagamento').value;
  const desconto = parseFloat(document.getElementById('pedido-desconto').value) || 0;
  const observacoes = document.getElementById('pedido-observacoes').value.trim();
  const itens = lerItensFormulario();
  const idExistente = document.getElementById('pedido-id').value;

  if (!clienteId) {
    document.getElementById('err-pedido-cliente').classList.add('show');
    document.getElementById('pedido-cliente').parentElement.classList.add('error');
    valido = false;
  }
  if (!vendedorId) {
    document.getElementById('err-pedido-vendedor').classList.add('show');
    document.getElementById('pedido-vendedor').parentElement.classList.add('error');
    valido = false;
  }
  if (itens.length === 0) {
    document.getElementById('err-pedido-itens').classList.add('show');
    valido = false;
  }

  if (!valido) {
    showToast('Corrija os campos destacados antes de salvar.', 'error');
    return;
  }

  // Verifica disponibilidade de estoque (considera devolução do próprio pedido em edição, se já baixado)
  const pedidoAnterior = idExistente ? DB.findById('pedidos', idExistente) : null;
  for (const item of itens) {
    const produto = DB.findById('produtos', item.produtoId);
    if (!produto) continue;
    let disponivel = produto.estoqueAtual;
    if (pedidoAnterior && pedidoAnterior.estoqueBaixado) {
      const itemAnterior = pedidoAnterior.itens.find(i => i.produtoId === item.produtoId);
      if (itemAnterior) disponivel += itemAnterior.quantidade;
    }
    if (item.quantidade > disponivel) {
      showToast(`Estoque insuficiente para "${produto.nome}". Disponível: ${disponivel}.`, 'error');
      return;
    }
  }

  const subtotal = itens.reduce((s, it) => s + it.quantidade * it.precoUnitario, 0);
  const total = Math.max(0, subtotal - desconto);

  if (idExistente) {
    // Se já havia baixado estoque, devolve antes de reaplicar (mantendo consistência)
    if (pedidoAnterior && pedidoAnterior.estoqueBaixado) {
      devolverEstoquePedido(pedidoAnterior);
    }
    const atualizado = DB.update('pedidos', idExistente, {
      clienteId, vendedorId, data, formaPagamento, desconto, observacoes,
      itens, subtotal, total
    });
    if (pedidoAnterior && pedidoAnterior.estoqueBaixado) {
      baixarEstoquePedido(atualizado);
      DB.update('pedidos', idExistente, { estoqueBaixado: true });
    }
    showToast('Pedido atualizado com sucesso!', 'success');
  } else {
    DB.add('pedidos', {
      numero: getNextPedidoNumero(),
      clienteId, vendedorId, data, itens, subtotal, desconto, total,
      formaPagamento, observacoes, status: 'Pendente', estoqueBaixado: false
    });
    showToast('Pedido criado com sucesso!', 'success');
  }

  closeModal('modal-pedido');
  renderTabelaPedidos();
}

/* ---------- Visualizar ---------- */
function visualizarPedido(id) {
  const p = DB.findById('pedidos', id);
  if (!p) return;
  const cliente = DB.findById('clientes', p.clienteId);
  const vendedor = DB.findById('vendedores', p.vendedorId);
  const produtos = DB.get('produtos');

  const itensHtml = p.itens.map(it => {
    const prod = produtos.find(pr => pr.id === it.produtoId);
    return `<tr>
      <td>${escapeHtml(prod ? prod.nome : '—')}</td>
      <td class="mono">${it.quantidade}</td>
      <td class="mono">${formatBRL(it.precoUnitario)}</td>
      <td class="mono">${formatBRL(it.quantidade * it.precoUnitario)}</td>
    </tr>`;
  }).join('');

  document.getElementById('ver-pedido-body').innerHTML = `
    <div class="detail-grid">
      <div><div class="k">Número</div><div class="v mono">${p.numero}</div></div>
      <div><div class="k">Status</div><div class="v">${statusBadge(p.status)}</div></div>
      <div><div class="k">Cliente</div><div class="v">${escapeHtml(cliente ? cliente.nome : '—')}</div></div>
      <div><div class="k">Vendedor</div><div class="v">${escapeHtml(vendedor ? vendedor.nome : '—')}</div></div>
      <div><div class="k">Data</div><div class="v">${formatDateBR(p.data)}</div></div>
      <div><div class="k">Forma de pagamento</div><div class="v">${escapeHtml(p.formaPagamento)}</div></div>
    </div>
    <div class="detail-section-title">Produtos</div>
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr><th>Produto</th><th>Qtd.</th><th>Preço unit.</th><th>Subtotal</th></tr></thead>
        <tbody>${itensHtml}</tbody>
      </table>
    </div>
    <div class="totals-box">
      <div class="line"><span>Subtotal</span><span class="mono">${formatBRL(p.subtotal)}</span></div>
      <div class="line"><span>Desconto</span><span class="mono">${formatBRL(p.desconto)}</span></div>
      <div class="line total"><span>Total</span><span class="mono">${formatBRL(p.total)}</span></div>
    </div>
    ${p.observacoes ? `<div class="detail-section-title">Observações</div><p style="font-size:13.5px;">${escapeHtml(p.observacoes)}</p>` : ''}
  `;
  openModal('modal-ver-pedido');
}

/* ---------- Alterar status ---------- */
function abrirStatusPedido(id) {
  const p = DB.findById('pedidos', id);
  if (!p) return;
  document.getElementById('status-pedido-id').value = id;
  const sel = document.getElementById('select-novo-status');
  sel.innerHTML = STATUS_PEDIDO.map(s => `<option value="${s}" ${s === p.status ? 'selected' : ''}>${s}</option>`).join('');
  openModal('modal-status-pedido');
}

function confirmarNovoStatus() {
  const id = document.getElementById('status-pedido-id').value;
  const novoStatus = document.getElementById('select-novo-status').value;
  const pedido = DB.findById('pedidos', id);
  if (!pedido) return;

  if (novoStatus === pedido.status) {
    closeModal('modal-status-pedido');
    return;
  }

  if (novoStatus === 'Cancelado') {
    if (pedido.estoqueBaixado) {
      devolverEstoquePedido(pedido);
    }
    DB.update('pedidos', id, { status: 'Cancelado', estoqueBaixado: false });
    showToast('Pedido cancelado!', 'warning');
  } else {
    if (!pedido.estoqueBaixado && novoStatus !== 'Pendente') {
      const resultado = baixarEstoquePedido(pedido);
      if (!resultado.ok) {
        showToast(`Estoque insuficiente para "${resultado.produto}". Não é possível confirmar.`, 'error');
        return;
      }
      DB.update('pedidos', id, { estoqueBaixado: true });
    }
    DB.update('pedidos', id, { status: novoStatus });
    showToast('Status do pedido atualizado!', 'success');
  }

  // Sincroniza entrega vinculada, se existir
  const entrega = DB.get('entregas').find(e => e.pedidoId === id);
  if (entrega) {
    if (novoStatus === 'Enviado') DB.update('entregas', entrega.id, { status: 'Saiu para entrega' });
    if (novoStatus === 'Entregue') DB.update('entregas', entrega.id, { status: 'Entregue', dataEntrega: todayISO() });
    if (novoStatus === 'Cancelado') DB.update('entregas', entrega.id, { status: 'Cancelado' });
  }

  closeModal('modal-status-pedido');
  renderTabelaPedidos();
}

/* ---------- Excluir ---------- */
function excluirPedido(id) {
  const pedido = DB.findById('pedidos', id);
  if (!pedido) return;
  if (!confirm(`Deseja realmente excluir o pedido ${pedido.numero}? Essa ação não pode ser desfeita.`)) return;

  if (pedido.estoqueBaixado) {
    devolverEstoquePedido(pedido);
  }
  DB.remove('pedidos', id);
  showToast('Pedido excluído!', 'warning');
  renderTabelaPedidos();
}