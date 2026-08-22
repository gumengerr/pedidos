/* =========================================================
   DistribuiPro — Comissões
   Calcula comissões por vendedor/período a partir dos pedidos
   e permite alterar o status (Pendente / A pagar / Pago).
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  preencherPeriodos();
  renderComissoes();
  document.getElementById('busca-comissao').addEventListener('input', renderComissoes);
  document.getElementById('filtro-periodo').addEventListener('change', renderComissoes);
  document.getElementById('filtro-status-comissao').addEventListener('change', renderComissoes);
});

/* Períodos (YYYY-MM) presentes nos pedidos, mais o mês atual */
function listarPeriodos() {
  const periodos = new Set([monthPeriod(todayISO())]);
  DB.get('pedidos').forEach(p => { if (p.data) periodos.add(monthPeriod(p.data)); });
  return Array.from(periodos).sort().reverse();
}

function preencherPeriodos() {
  const select = document.getElementById('filtro-periodo');
  const periodos = listarPeriodos();
  select.innerHTML = `<option value="">Todos os períodos</option>` +
    periodos.map(p => `<option value="${p}">${monthLabel(p)}</option>`).join('');
  select.value = monthPeriod(todayISO());
  if (!periodos.includes(select.value)) select.value = '';
}

/* Status persistido em DB('comissoes') por vendedor + período */
function getRegistroComissao(vendedorId, periodo) {
  return DB.get('comissoes').find(c => c.vendedorId === vendedorId && c.periodo === periodo) || null;
}

function getStatusComissao(vendedorId, periodo) {
  const reg = getRegistroComissao(vendedorId, periodo);
  return reg ? reg.status : 'Pendente';
}

function definirStatusComissao(vendedorId, periodo, status) {
  const reg = getRegistroComissao(vendedorId, periodo);
  if (reg) {
    DB.update('comissoes', reg.id, { status, dataPagamento: status === 'Pago' ? todayISO() : '' });
  } else {
    DB.add('comissoes', {
      vendedorId, periodo, status,
      dataPagamento: status === 'Pago' ? todayISO() : ''
    });
  }
  showToast('Status da comissão atualizado para "' + status + '".', 'success');
  renderComissoes();
}

function pedidosComissionaveis(vendedorId, periodo) {
  return DB.get('pedidos').filter(p =>
    p.vendedorId === vendedorId &&
    p.status !== 'Pendente' && p.status !== 'Cancelado' &&
    (!periodo || monthPeriod(p.data) === periodo)
  );
}

function montarLinhas() {
  const periodoFiltro = document.getElementById('filtro-periodo').value;
  const busca = document.getElementById('busca-comissao').value.trim().toLowerCase();
  const statusFiltro = document.getElementById('filtro-status-comissao').value;

  const periodos = periodoFiltro ? [periodoFiltro] : listarPeriodos();
  const vendedores = DB.get('vendedores');

  const linhas = [];
  vendedores.forEach(v => {
    if (busca && !(v.nome || '').toLowerCase().includes(busca)) return;
    periodos.forEach(periodo => {
      const pedidos = pedidosComissionaveis(v.id, periodo);
      if (pedidos.length === 0) return;
      const totalVendas = pedidos.reduce((s, p) => s + (p.total || 0), 0);
      const percentual = Number(v.percentualComissao || 0);
      const valor = totalVendas * (percentual / 100);
      const status = getStatusComissao(v.id, periodo);
      if (statusFiltro && status !== statusFiltro) return;
      linhas.push({ vendedor: v, periodo, pedidos, totalVendas, percentual, valor, status });
    });
  });

  return linhas.sort((a, b) => b.periodo.localeCompare(a.periodo) || b.valor - a.valor);
}

function renderComissoes() {
  const linhas = montarLinhas();
  renderKpisComissoes(linhas);

  const tbody = document.getElementById('tbl-comissoes');
  if (linhas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="ic">💰</div>Nenhuma comissão encontrada para os filtros selecionados.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = linhas.map(l => `
    <tr>
      <td>${escapeHtml(l.vendedor.nome)}</td>
      <td>${monthLabel(l.periodo)}</td>
      <td class="mono">${formatBRL(l.totalVendas)}</td>
      <td>${l.pedidos.length}</td>
      <td class="mono">${formatPercent(l.percentual)}</td>
      <td class="mono">${formatBRL(l.valor)}</td>
      <td>${statusBadge(l.status)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-icon" title="Visualizar" onclick="visualizarComissao('${l.vendedor.id}','${l.periodo}')">👁️</button>
          ${l.status !== 'A pagar' && l.status !== 'Pago'
            ? `<button class="btn btn-ghost btn-icon" title="Marcar como a pagar" onclick="definirStatusComissao('${l.vendedor.id}','${l.periodo}','A pagar')">📌</button>` : ''}
          ${l.status !== 'Pago'
            ? `<button class="btn btn-ghost btn-icon" title="Marcar como pago" onclick="definirStatusComissao('${l.vendedor.id}','${l.periodo}','Pago')">✅</button>`
            : `<button class="btn btn-ghost btn-icon" title="Reabrir comissão" onclick="definirStatusComissao('${l.vendedor.id}','${l.periodo}','Pendente')">↩️</button>`}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderKpisComissoes(linhas) {
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  const pago = linhas.filter(l => l.status === 'Pago').reduce((s, l) => s + l.valor, 0);
  const aPagar = linhas.filter(l => l.status === 'A pagar').reduce((s, l) => s + l.valor, 0);
  const pendente = linhas.filter(l => l.status === 'Pendente').reduce((s, l) => s + l.valor, 0);

  const cards = [
    { label: 'Comissão total', value: formatBRL(total), icon: '💰', cls: 'teal', foot: linhas.length + ' registro(s)' },
    { label: 'Pendente', value: formatBRL(pendente), icon: '🕒', cls: 'amber', foot: 'aguardando conferência' },
    { label: 'A pagar', value: formatBRL(aPagar), icon: '📌', cls: 'info', foot: 'liberado para pagamento' },
    { label: 'Pago', value: formatBRL(pago), icon: '✅', cls: 'teal', foot: 'já quitado' }
  ];

  document.getElementById('kpi-comissoes').innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">${c.label}</span>
        <span class="kpi-icon ${c.cls}">${c.icon}</span>
      </div>
      <div class="kpi-value">${c.value}</div>
      <span class="kpi-foot">${c.foot}</span>
    </div>
  `).join('');
}

function visualizarComissao(vendedorId, periodo) {
  const v = DB.findById('vendedores', vendedorId);
  if (!v) return;
  const pedidos = pedidosComissionaveis(vendedorId, periodo).sort((a, b) => new Date(b.data) - new Date(a.data));
  const clientes = DB.get('clientes');
  const totalVendas = pedidos.reduce((s, p) => s + (p.total || 0), 0);
  const percentual = Number(v.percentualComissao || 0);
  const valor = totalVendas * (percentual / 100);
  const status = getStatusComissao(vendedorId, periodo);
  const reg = getRegistroComissao(vendedorId, periodo);

  const pedidosHtml = pedidos.length === 0
    ? `<div class="empty-state"><div class="ic">🧾</div>Nenhum pedido comissionável neste período.</div>`
    : `<div class="table-scroll"><table class="data-table">
        <thead><tr><th>Número</th><th>Cliente</th><th>Data</th><th>Valor</th><th>Comissão</th><th>Status</th></tr></thead>
        <tbody>${pedidos.map(p => {
          const c = clientes.find(c => c.id === p.clienteId);
          return `<tr>
            <td class="mono">${escapeHtml(p.numero)}</td>
            <td>${escapeHtml(c ? c.nome : '—')}</td>
            <td>${formatDateBR(p.data)}</td>
            <td class="mono">${formatBRL(p.total)}</td>
            <td class="mono">${formatBRL((p.total || 0) * percentual / 100)}</td>
            <td>${statusBadge(p.status)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;

  document.getElementById('ver-comissao-body').innerHTML = `
    <div class="detail-grid">
      <div><div class="k">Vendedor</div><div class="v">${escapeHtml(v.nome)}</div></div>
      <div><div class="k">Período</div><div class="v">${monthLabel(periodo)}</div></div>
      <div><div class="k">Percentual</div><div class="v">${formatPercent(percentual)}</div></div>
      <div><div class="k">Status</div><div class="v">${statusBadge(status)}</div></div>
      <div><div class="k">Total vendido</div><div class="v mono">${formatBRL(totalVendas)}</div></div>
      <div><div class="k">Comissão</div><div class="v mono">${formatBRL(valor)}</div></div>
      <div><div class="k">Data do pagamento</div><div class="v">${reg && reg.dataPagamento ? formatDateBR(reg.dataPagamento) : '—'}</div></div>
    </div>

    <div class="detail-section-title">Pedidos considerados</div>
    ${pedidosHtml}
  `;
  openModal('modal-ver-comissao');
}
