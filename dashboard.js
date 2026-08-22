document.addEventListener('DOMContentLoaded', () => {
  renderKpis();
  renderChart();
  renderRanking();
  renderPedidosRecentes();
  renderEstoqueBaixo();
});

function renderKpis() {
  const pedidos = DB.get('pedidos');
  const produtos = DB.get('produtos');
  const clientes = DB.get('clientes');
  const vendedores = DB.get('vendedores');
  const hoje = todayISO();

  const vendasHoje = pedidos.filter(p => p.data === hoje && p.status !== 'Cancelado' && p.status !== 'Pendente')
    .reduce((s, p) => s + p.total, 0);

  const mesAtual = monthPeriod(hoje);
  const vendasMes = pedidos.filter(p => monthPeriod(p.data) === mesAtual && p.status !== 'Cancelado' && p.status !== 'Pendente')
    .reduce((s, p) => s + p.total, 0);

  const pendentes = pedidos.filter(p => p.status === 'Pendente').length;
  const entregues = pedidos.filter(p => p.status === 'Entregue').length;
  const estoqueTotal = produtos.reduce((s, p) => s + p.estoqueAtual, 0);
  const estoqueBaixo = produtos.filter(p => p.estoqueAtual <= p.estoqueMinimo).length;

  const cards = [
    { label: 'Vendas do dia', value: formatBRL(vendasHoje), icon: '💵', cls: 'teal', foot: hoje.split('-').reverse().join('/') },
    { label: 'Vendas do mês', value: formatBRL(vendasMes), icon: '📈', cls: 'teal', foot: monthLabel(mesAtual) },
    { label: 'Pedidos pendentes', value: pendentes, icon: '🕒', cls: 'amber', foot: 'aguardando confirmação' },
    { label: 'Pedidos entregues', value: entregues, icon: '✅', cls: 'info', foot: 'concluídos' },
    { label: 'Produtos em estoque', value: estoqueTotal, icon: '📦', cls: 'teal', foot: produtos.length + ' produtos cadastrados' },
    { label: 'Estoque baixo', value: estoqueBaixo, icon: '⚠️', cls: 'danger', foot: 'itens precisam de reposição' },
    { label: 'Total de clientes', value: clientes.length, icon: '👥', cls: 'info', foot: 'clientes ativos' },
    { label: 'Total de vendedores', value: vendedores.length, icon: '🧑‍💼', cls: 'amber', foot: vendedores.filter(v => v.status === 'Ativo').length + ' ativos' },
  ];

  document.getElementById('kpi-grid').innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">${c.label}</span>
        <div class="kpi-icon ${c.cls}">${c.icon}</div>
      </div>
      <div class="kpi-value">${c.value}</div>
      <div class="kpi-foot">${c.foot}</div>
    </div>
  `).join('');
}

function renderChart() {
  const pedidos = DB.get('pedidos');
  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const total = pedidos.filter(p => p.data === iso && p.status !== 'Cancelado' && p.status !== 'Pendente').reduce((s, p) => s + p.total, 0);
    dias.push({ iso, total, label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') });
  }
  const max = Math.max(...dias.map(d => d.total), 1);
  document.getElementById('chart-bars').innerHTML = dias.map(d => `
    <div class="bar-col">
      <span class="bar-value">${d.total > 0 ? formatBRL(d.total).replace('R$', '').trim() : '-'}</span>
      <div class="bar" style="height:${Math.max(4, (d.total / max) * 150)}px"></div>
      <span class="bar-label">${d.label}</span>
    </div>
  `).join('');
}

function renderRanking() {
  const vendedores = DB.get('vendedores');
  const linhas = vendedores.map(v => {
    const { total, quantidade } = getVendasVendedor(v.id);
    const comissao = total * (v.percentualComissao / 100);
    return { nome: v.nome, total, quantidade, comissao };
  }).sort((a, b) => b.total - a.total);

  const tbody = document.getElementById('tbl-ranking');
  if (linhas.every(l => l.total === 0)) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="ic">📉</div>Nenhuma venda registrada ainda.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = linhas.map(l => `
    <tr>
      <td>${escapeHtml(l.nome)}</td>
      <td class="mono">${formatBRL(l.total)}</td>
      <td>${l.quantidade}</td>
      <td class="mono">${formatBRL(l.comissao)}</td>
    </tr>
  `).join('');
}

function renderPedidosRecentes() {
  const pedidos = [...DB.get('pedidos')].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 6);
  const clientes = DB.get('clientes');
  const vendedores = DB.get('vendedores');
  const tbody = document.getElementById('tbl-pedidos-recentes');

  if (pedidos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="ic">🧾</div>Nenhum pedido registrado ainda.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = pedidos.map(p => {
    const cliente = clientes.find(c => c.id === p.clienteId);
    const vendedor = vendedores.find(v => v.id === p.vendedorId);
    return `
      <tr>
        <td class="mono">${p.numero}</td>
        <td>${escapeHtml(cliente ? cliente.nome : '—')}</td>
        <td>${escapeHtml(vendedor ? vendedor.nome : '—')}</td>
        <td class="mono">${formatBRL(p.total)}</td>
        <td>${statusBadge(p.status)}</td>
        <td>${formatDateBR(p.data)}</td>
      </tr>
    `;
  }).join('');
}

function renderEstoqueBaixo() {
  const produtos = DB.get('produtos').filter(p => p.estoqueAtual <= p.estoqueMinimo).sort((a, b) => a.estoqueAtual - b.estoqueAtual);
  const tbody = document.getElementById('tbl-estoque-baixo');

  if (produtos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="ic">✅</div>Nenhum produto com estoque baixo. Tudo certo por aqui!</div></td></tr>`;
    return;
  }

  tbody.innerHTML = produtos.map(p => {
    const st = getProdutoStatus(p);
    return `
      <tr>
        <td>${escapeHtml(p.nome)}</td>
        <td class="mono">${p.estoqueAtual}</td>
        <td class="mono">${p.estoqueMinimo}</td>
        <td><span class="badge ${st.cls}">${st.label}</span></td>
      </tr>
    `;
  }).join('');
}