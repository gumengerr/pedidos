document.addEventListener('DOMContentLoaded', () => {
  renderRankingVendedores();
  renderTabelaVendedores();
  document.getElementById('btn-novo-vendedor').addEventListener('click', abrirNovoVendedor);
  document.getElementById('btn-salvar-vendedor').addEventListener('click', salvarVendedor);
  document.getElementById('busca-vendedor').addEventListener('input', renderTabelaVendedores);
});

function getEstatisticasVendedor(vendedorId) {
  const { total, quantidade } = getVendasVendedor(vendedorId);
  const vendedor = DB.findById('vendedores', vendedorId);
  const comissao = total * ((vendedor?.percentualComissao || 0) / 100);
  const ticketMedio = quantidade > 0 ? total / quantidade : 0;
  const clientesAtendidos = new Set(
    DB.get('pedidos').filter(p => p.vendedorId === vendedorId && p.status !== 'Cancelado').map(p => p.clienteId)
  ).size;
  return { total, quantidade, comissao, ticketMedio, clientesAtendidos };
}

function renderRankingVendedores() {
  const vendedores = DB.get('vendedores');
  const linhas = vendedores.map(v => ({ v, ...getEstatisticasVendedor(v.id) })).sort((a, b) => b.total - a.total);
  const tbody = document.getElementById('tbl-ranking-vendedores');

  if (linhas.every(l => l.total === 0)) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="ic">🏆</div>Nenhuma venda registrada ainda.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = linhas.map((l, i) => `
    <tr>
      <td class="mono">${i + 1}º</td>
      <td>${escapeHtml(l.v.nome)}</td>
      <td class="mono">${formatBRL(l.total)}</td>
      <td>${l.quantidade}</td>
      <td class="mono">${formatBRL(l.comissao)}</td>
    </tr>
  `).join('');
}

function renderTabelaVendedores() {
  const busca = document.getElementById('busca-vendedor').value.trim().toLowerCase();
  const vendedores = DB.get('vendedores').filter(v => !busca || v.nome.toLowerCase().includes(busca));
  const tbody = document.getElementById('tbl-vendedores');

  if (vendedores.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="ic">🧑‍💼</div>Nenhum vendedor encontrado.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = vendedores.map(v => {
    const est = getEstatisticasVendedor(v.id);
    return `
      <tr>
        <td>${escapeHtml(v.nome)}</td>
        <td>${escapeHtml(v.telefone)}</td>
        <td class="mono">${formatPercent(v.percentualComissao)}</td>
        <td class="mono">${formatBRL(est.total)}</td>
        <td>${est.quantidade}</td>
        <td>${statusBadge(v.status)}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-icon" title="Visualizar" onclick="visualizarVendedor('${v.id}')">👁️</button>
            <button class="btn btn-ghost btn-icon" title="Editar" onclick="editarVendedor('${v.id}')">✏️</button>
            <button class="btn btn-ghost btn-icon" title="Excluir" onclick="excluirVendedor('${v.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function abrirNovoVendedor() {
  document.getElementById('form-vendedor').reset();
  document.getElementById('vendedor-id').value = '';
  document.getElementById('modal-vendedor-titulo').textContent = 'Novo Vendedor';
  document.getElementById('vendedor-data-entrada').value = todayISO();
  limparErrosVendedor();
  openModal('modal-vendedor');
}

function editarVendedor(id) {
  const v = DB.findById('vendedores', id);
  if (!v) return;
  document.getElementById('form-vendedor').reset();
  limparErrosVendedor();
  document.getElementById('vendedor-id').value = v.id;
  document.getElementById('modal-vendedor-titulo').textContent = 'Editar Vendedor';
  document.getElementById('vendedor-nome').value = v.nome;
  document.getElementById('vendedor-cpf').value = v.cpf;
  document.getElementById('vendedor-telefone').value = v.telefone;
  document.getElementById('vendedor-email').value = v.email || '';
  document.getElementById('vendedor-data-entrada').value = v.dataEntrada || '';
  document.getElementById('vendedor-percentual').value = v.percentualComissao;
  document.getElementById('vendedor-status').value = v.status;
  openModal('modal-vendedor');
}

function limparErrosVendedor() {
  ['vendedor-nome', 'vendedor-cpf', 'vendedor-telefone', 'vendedor-percentual'].forEach(id => {
    document.getElementById('err-' + id).classList.remove('show');
    document.getElementById(id).parentElement.classList.remove('error');
  });
}

function salvarVendedor() {
  limparErrosVendedor();
  let valido = true;
  const marcarErro = (id) => {
    document.getElementById('err-' + id).classList.add('show');
    document.getElementById(id).parentElement.classList.add('error');
    valido = false;
  };

  const nome = document.getElementById('vendedor-nome').value.trim();
  const cpf = document.getElementById('vendedor-cpf').value.trim();
  const telefone = document.getElementById('vendedor-telefone').value.trim();
  const percentualComissao = parseFloat(document.getElementById('vendedor-percentual').value);
  const idExistente = document.getElementById('vendedor-id').value;

  if (!nome) marcarErro('vendedor-nome');
  if (!cpf) marcarErro('vendedor-cpf');
  if (!telefone) marcarErro('vendedor-telefone');
  if (isNaN(percentualComissao) || percentualComissao < 0) marcarErro('vendedor-percentual');

  if (!valido) {
    showToast('Corrija os campos destacados antes de salvar.', 'error');
    return;
  }

  const dados = {
    nome, cpf, telefone,
    email: document.getElementById('vendedor-email').value.trim(),
    dataEntrada: document.getElementById('vendedor-data-entrada').value,
    percentualComissao,
    status: document.getElementById('vendedor-status').value
  };

  if (idExistente) {
    DB.update('vendedores', idExistente, dados);
    showToast('Vendedor atualizado!', 'success');
  } else {
    DB.add('vendedores', dados);
    showToast('Vendedor cadastrado com sucesso!', 'success');
  }

  closeModal('modal-vendedor');
  renderRankingVendedores();
  renderTabelaVendedores();
}

function excluirVendedor(id) {
  const v = DB.findById('vendedores', id);
  if (!v) return;
  if (!confirm(`Deseja realmente excluir o vendedor "${v.nome}"?`)) return;
  DB.remove('vendedores', id);
  showToast('Vendedor removido!', 'warning');
  renderRankingVendedores();
  renderTabelaVendedores();
}

function visualizarVendedor(id) {
  const v = DB.findById('vendedores', id);
  if (!v) return;
  const est = getEstatisticasVendedor(id);
  const clientes = DB.get('clientes');
  const pedidos = DB.get('pedidos').filter(p => p.vendedorId === id).sort((a, b) => new Date(b.data) - new Date(a.data));

  const pedidosHtml = pedidos.length === 0
    ? `<div class="empty-state"><div class="ic">🧾</div>Nenhum pedido registrado para este vendedor.</div>`
    : `<div class="table-scroll"><table class="data-table">
        <thead><tr><th>Número</th><th>Cliente</th><th>Data</th><th>Valor</th><th>Status</th></tr></thead>
        <tbody>${pedidos.map(p => {
          const c = clientes.find(c => c.id === p.clienteId);
          return `<tr><td class="mono">${p.numero}</td><td>${escapeHtml(c ? c.nome : '—')}</td><td>${formatDateBR(p.data)}</td><td class="mono">${formatBRL(p.total)}</td><td>${statusBadge(p.status)}</td></tr>`;
        }).join('')}</tbody>
      </table></div>`;

  document.getElementById('ver-vendedor-body').innerHTML = `
    <div class="detail-grid">
      <div><div class="k">Nome</div><div class="v">${escapeHtml(v.nome)}</div></div>
      <div><div class="k">CPF</div><div class="v mono">${escapeHtml(v.cpf)}</div></div>
      <div><div class="k">Telefone</div><div class="v">${escapeHtml(v.telefone)}</div></div>
      <div><div class="k">Email</div><div class="v">${escapeHtml(v.email || '—')}</div></div>
      <div><div class="k">Data de entrada</div><div class="v">${formatDateBR(v.dataEntrada)}</div></div>
      <div><div class="k">Percentual de comissão</div><div class="v">${formatPercent(v.percentualComissao)}</div></div>
    </div>

    <div class="grid-kpi" style="grid-template-columns:repeat(3,1fr); margin-top:18px;">
      <div class="kpi-card"><span class="kpi-label">Total vendido</span><div class="kpi-value" style="font-size:18px;">${formatBRL(est.total)}</div></div>
      <div class="kpi-card"><span class="kpi-label">Total de pedidos</span><div class="kpi-value" style="font-size:18px;">${est.quantidade}</div></div>
      <div class="kpi-card"><span class="kpi-label">Comissão gerada</span><div class="kpi-value" style="font-size:18px;">${formatBRL(est.comissao)}</div></div>
      <div class="kpi-card"><span class="kpi-label">Ticket médio</span><div class="kpi-value" style="font-size:18px;">${formatBRL(est.ticketMedio)}</div></div>
      <div class="kpi-card"><span class="kpi-label">Clientes atendidos</span><div class="kpi-value" style="font-size:18px;">${est.clientesAtendidos}</div></div>
    </div>

    <div class="detail-section-title">Pedidos do vendedor</div>
    ${pedidosHtml}
  `;
  openModal('modal-ver-vendedor');
}