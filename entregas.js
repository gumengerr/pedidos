document.addEventListener('DOMContentLoaded', () => {
  popularFiltroStatusEntrega();
  popularSelectPedidoEntrega();
  renderKpisEntregas();
  renderTabelaEntregas();

  document.getElementById('btn-nova-entrega').addEventListener('click', abrirNovaEntrega);
  document.getElementById('btn-salvar-entrega').addEventListener('click', salvarEntrega);
  document.getElementById('btn-confirmar-status-entrega').addEventListener('click', confirmarStatusEntrega);
  document.getElementById('entrega-pedido').addEventListener('change', preencherEnderecoEntrega);
  document.getElementById('filtro-entrega-status').addEventListener('change', renderTabelaEntregas);
});

function popularFiltroStatusEntrega() {
  const sel = document.getElementById('filtro-entrega-status');
  STATUS_ENTREGA.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    sel.appendChild(opt);
  });
}

function popularSelectPedidoEntrega() {
  const sel = document.getElementById('entrega-pedido');
  const entregas = DB.get('entregas');
  const pedidosComEntrega = new Set(entregas.map(e => e.pedidoId));
  const clientes = DB.get('clientes');
  const pedidos = DB.get('pedidos').filter(p => p.status !== 'Pendente' && p.status !== 'Cancelado' && !pedidosComEntrega.has(p.id));

  pedidos.forEach(p => {
    const cliente = clientes.find(c => c.id === p.clienteId);
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.numero} — ${cliente ? cliente.nome : '—'}`;
    sel.appendChild(opt);
  });
}

function preencherEnderecoEntrega() {
  const pedidoId = document.getElementById('entrega-pedido').value;
  const pedido = DB.findById('pedidos', pedidoId);
  if (!pedido) return;
  const cliente = DB.findById('clientes', pedido.clienteId);
  if (cliente) {
    document.getElementById('entrega-endereco').value = `${cliente.endereco || ''}, ${cliente.numero || ''} - ${cliente.bairro || ''}, ${cliente.cidade || ''}/${cliente.estado || ''}`;
  }
}

function renderKpisEntregas() {
  const entregas = DB.get('entregas');
  const hoje = todayISO();
  const hojeCount = entregas.filter(e => e.dataPrevista === hoje).length;
  const pendentes = entregas.filter(e => e.status === 'Aguardando separação' || e.status === 'Separado').length;
  const emRota = entregas.filter(e => e.status === 'Saiu para entrega').length;
  const entregues = entregas.filter(e => e.status === 'Entregue').length;

  const cards = [
    { label: 'Entregas hoje', value: hojeCount, icon: '📅', cls: 'teal' },
    { label: 'Pendentes', value: pendentes, icon: '🕒', cls: 'amber' },
    { label: 'Em rota', value: emRota, icon: '🚚', cls: 'info' },
    { label: 'Entregues', value: entregues, icon: '✅', cls: 'teal' }
  ];

  document.getElementById('kpi-entregas').innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="kpi-top"><span class="kpi-label">${c.label}</span><div class="kpi-icon ${c.cls}">${c.icon}</div></div>
      <div class="kpi-value">${c.value}</div>
    </div>
  `).join('');
}

function renderTabelaEntregas() {
  const fStatus = document.getElementById('filtro-entrega-status').value;
  const pedidos = DB.get('pedidos');
  const clientes = DB.get('clientes');
  let entregas = [...DB.get('entregas')].sort((a, b) => (b.dataPrevista || '').localeCompare(a.dataPrevista || ''));
  if (fStatus) entregas = entregas.filter(e => e.status === fStatus);

  const tbody = document.getElementById('tbl-entregas');
  if (entregas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="ic">🚚</div>Nenhuma entrega encontrada.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = entregas.map(e => {
    const pedido = pedidos.find(p => p.id === e.pedidoId);
    const cliente = clientes.find(c => c.id === e.clienteId);
    return `
      <tr>
        <td class="mono">${pedido ? pedido.numero : '—'}</td>
        <td>${escapeHtml(cliente ? cliente.nome : '—')}</td>
        <td style="max-width:220px;" title="${escapeHtml(e.endereco)}">${escapeHtml(e.endereco.length > 36 ? e.endereco.slice(0, 36) + '…' : e.endereco)}</td>
        <td>${formatDateBR(e.dataPrevista)}</td>
        <td>${escapeHtml(e.responsavel)}</td>
        <td>${statusBadge(e.status)}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-icon" title="Alterar status" onclick="abrirStatusEntrega('${e.id}')">🔄</button>
            <button class="btn btn-ghost btn-icon" title="Excluir" onclick="excluirEntrega('${e.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function abrirNovaEntrega() {
  document.getElementById('form-entrega').reset();
  limparErrosEntrega();
  document.getElementById('entrega-data-prevista').value = todayISO();
  document.getElementById('entrega-endereco').value = '';
  openModal('modal-entrega');
}

function limparErrosEntrega() {
  ['entrega-pedido', 'entrega-responsavel'].forEach(id => {
    document.getElementById('err-' + id).classList.remove('show');
    document.getElementById(id).parentElement.classList.remove('error');
  });
}

function salvarEntrega() {
  limparErrosEntrega();
  let valido = true;
  const marcarErro = (id) => {
    document.getElementById('err-' + id).classList.add('show');
    document.getElementById(id).parentElement.classList.add('error');
    valido = false;
  };

  const pedidoId = document.getElementById('entrega-pedido').value;
  const responsavel = document.getElementById('entrega-responsavel').value.trim();
  const dataPrevista = document.getElementById('entrega-data-prevista').value || todayISO();
  const observacoes = document.getElementById('entrega-observacoes').value.trim();
  let endereco = document.getElementById('entrega-endereco').value.trim();

  if (!pedidoId) marcarErro('entrega-pedido');
  if (!responsavel) marcarErro('entrega-responsavel');

  if (!valido) {
    showToast('Corrija os campos destacados antes de salvar.', 'error');
    return;
  }

  const pedido = DB.findById('pedidos', pedidoId);
  if (!endereco && pedido) {
    const cliente = DB.findById('clientes', pedido.clienteId);
    if (cliente) endereco = `${cliente.endereco || ''}, ${cliente.numero || ''} - ${cliente.bairro || ''}, ${cliente.cidade || ''}/${cliente.estado || ''}`;
  }

  DB.add('entregas', {
    pedidoId, clienteId: pedido ? pedido.clienteId : null,
    endereco, responsavel, dataPrevista, dataEntrega: '', observacoes,
    status: 'Aguardando separação'
  });

  showToast('Entrega criada com sucesso!', 'success');
  closeModal('modal-entrega');
  location.reload();
}

function abrirStatusEntrega(id) {
  const e = DB.findById('entregas', id);
  if (!e) return;
  document.getElementById('status-entrega-id').value = id;
  const sel = document.getElementById('select-novo-status-entrega');
  sel.innerHTML = STATUS_ENTREGA.map(s => `<option value="${s}" ${s === e.status ? 'selected' : ''}>${s}</option>`).join('');
  openModal('modal-status-entrega');
}

function confirmarStatusEntrega() {
  const id = document.getElementById('status-entrega-id').value;
  const novoStatus = document.getElementById('select-novo-status-entrega').value;
  const patch = { status: novoStatus };
  if (novoStatus === 'Entregue') patch.dataEntrega = todayISO();
  DB.update('entregas', id, patch);

  // Sincroniza pedido vinculado
  const entrega = DB.findById('entregas', id);
  if (entrega && entrega.pedidoId) {
    if (novoStatus === 'Saiu para entrega') DB.update('pedidos', entrega.pedidoId, { status: 'Enviado' });
    if (novoStatus === 'Entregue') DB.update('pedidos', entrega.pedidoId, { status: 'Entregue' });
  }

  showToast('Status da entrega atualizado!', 'success');
  closeModal('modal-status-entrega');
  renderKpisEntregas();
  renderTabelaEntregas();
}

function excluirEntrega(id) {
  if (!confirm('Deseja realmente excluir esta entrega?')) return;
  DB.remove('entregas', id);
  showToast('Entrega removida!', 'warning');
  renderKpisEntregas();
  renderTabelaEntregas();
}