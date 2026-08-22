/* =========================================================
   DistribuiPro — Clientes (CRUD + histórico)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  renderTabelaClientes();
  document.getElementById('btn-novo-cliente').addEventListener('click', abrirNovoCliente);
  document.getElementById('btn-salvar-cliente').addEventListener('click', salvarCliente);
  document.getElementById('busca-cliente').addEventListener('input', renderTabelaClientes);
});

function getEstatisticasCliente(clienteId) {
  const pedidos = DB.get('pedidos').filter(p => p.clienteId === clienteId && p.status !== 'Cancelado');
  const total = pedidos.reduce((s, p) => s + (p.total || 0), 0);
  const datas = pedidos.map(p => p.data).filter(Boolean).sort();
  return {
    total,
    quantidade: pedidos.length,
    ultimaCompra: datas.length ? datas[datas.length - 1] : '',
    ticketMedio: pedidos.length ? total / pedidos.length : 0,
    pedidos: pedidos.sort((a, b) => new Date(b.data) - new Date(a.data))
  };
}

function clienteStatus(est) {
  return est.quantidade > 0 ? 'Ativo' : 'Inativo';
}

function renderTabelaClientes() {
  const busca = document.getElementById('busca-cliente').value.trim().toLowerCase();
  const clientes = DB.get('clientes').filter(c =>
    !busca ||
    (c.nome || '').toLowerCase().includes(busca) ||
    (c.documento || '').toLowerCase().includes(busca)
  );
  const tbody = document.getElementById('tbl-clientes');

  if (clientes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="ic">👥</div>Nenhum cliente encontrado.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = clientes.map(c => {
    const est = getEstatisticasCliente(c.id);
    return `
      <tr>
        <td>${escapeHtml(c.nome)}</td>
        <td class="mono">${escapeHtml(c.documento || '—')}</td>
        <td>${escapeHtml(c.telefone || '—')}</td>
        <td>${escapeHtml(c.cidade || '—')}${c.estado ? '/' + escapeHtml(c.estado) : ''}</td>
        <td class="mono">${formatBRL(est.total)}</td>
        <td>${est.ultimaCompra ? formatDateBR(est.ultimaCompra) : '—'}</td>
        <td>${statusBadge(clienteStatus(est))}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-icon" title="Visualizar" onclick="visualizarCliente('${c.id}')">👁️</button>
            <button class="btn btn-ghost btn-icon" title="Editar" onclick="editarCliente('${c.id}')">✏️</button>
            <button class="btn btn-ghost btn-icon" title="Excluir" onclick="excluirCliente('${c.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

const CAMPOS_CLIENTE = [
  'nome', 'documento', 'telefone', 'whatsapp', 'email',
  'cep', 'endereco', 'numero', 'bairro', 'cidade', 'estado', 'observacoes'
];

function limparErrosCliente() {
  document.querySelectorAll('#form-cliente .field-error').forEach(e => e.classList.remove('show'));
  document.querySelectorAll('#form-cliente .form-field').forEach(e => e.classList.remove('error'));
}

function abrirNovoCliente() {
  document.getElementById('form-cliente').reset();
  document.getElementById('cliente-id').value = '';
  document.getElementById('modal-cliente-titulo').textContent = 'Novo Cliente';
  limparErrosCliente();
  openModal('modal-cliente');
}

function editarCliente(id) {
  const c = DB.findById('clientes', id);
  if (!c) return;
  document.getElementById('form-cliente').reset();
  limparErrosCliente();
  document.getElementById('cliente-id').value = c.id;
  document.getElementById('modal-cliente-titulo').textContent = 'Editar Cliente';
  CAMPOS_CLIENTE.forEach(campo => {
    const el = document.getElementById('cliente-' + campo.replace('observacoes', 'observacoes'));
    if (el) el.value = c[campo] || '';
  });
  openModal('modal-cliente');
}

function salvarCliente() {
  limparErrosCliente();
  let valido = true;
  const marcarErro = (id) => {
    const err = document.getElementById('err-' + id);
    if (err) err.classList.add('show');
    const campo = document.getElementById(id);
    if (campo) campo.parentElement.classList.add('error');
    valido = false;
  };

  const nome = document.getElementById('cliente-nome').value.trim();
  const documento = document.getElementById('cliente-documento').value.trim();
  const telefone = document.getElementById('cliente-telefone').value.trim();
  const idExistente = document.getElementById('cliente-id').value;

  if (!nome) marcarErro('cliente-nome');
  if (!documento) marcarErro('cliente-documento');
  if (!telefone) marcarErro('cliente-telefone');

  if (!valido) {
    showToast('Corrija os campos destacados antes de salvar.', 'error');
    return;
  }

  const dados = {};
  CAMPOS_CLIENTE.forEach(campo => {
    const el = document.getElementById('cliente-' + campo);
    dados[campo] = el ? el.value.trim() : '';
  });
  dados.estado = (dados.estado || '').toUpperCase();

  if (idExistente) {
    DB.update('clientes', idExistente, dados);
    showToast('Cliente atualizado!', 'success');
  } else {
    DB.add('clientes', dados);
    showToast('Cliente cadastrado com sucesso!', 'success');
  }

  closeModal('modal-cliente');
  renderTabelaClientes();
}

function excluirCliente(id) {
  const c = DB.findById('clientes', id);
  if (!c) return;
  const temPedidos = DB.get('pedidos').some(p => p.clienteId === id);
  if (temPedidos) {
    showToast('Não é possível excluir: o cliente possui pedidos registrados.', 'error');
    return;
  }
  if (!confirm(`Deseja realmente excluir o cliente "${c.nome}"?`)) return;
  DB.remove('clientes', id);
  showToast('Cliente removido!', 'warning');
  renderTabelaClientes();
}

function visualizarCliente(id) {
  const c = DB.findById('clientes', id);
  if (!c) return;
  const est = getEstatisticasCliente(id);
  const vendedores = DB.get('vendedores');

  const pedidosHtml = est.pedidos.length === 0
    ? `<div class="empty-state"><div class="ic">🧾</div>Nenhum pedido registrado para este cliente.</div>`
    : `<div class="table-scroll"><table class="data-table">
        <thead><tr><th>Número</th><th>Vendedor</th><th>Data</th><th>Valor</th><th>Status</th></tr></thead>
        <tbody>${est.pedidos.map(p => {
          const v = vendedores.find(v => v.id === p.vendedorId);
          return `<tr><td class="mono">${escapeHtml(p.numero)}</td><td>${escapeHtml(v ? v.nome : '—')}</td><td>${formatDateBR(p.data)}</td><td class="mono">${formatBRL(p.total)}</td><td>${statusBadge(p.status)}</td></tr>`;
        }).join('')}</tbody>
      </table></div>`;

  document.getElementById('ver-cliente-body').innerHTML = `
    <div class="detail-grid">
      <div><div class="k">Nome / Razão Social</div><div class="v">${escapeHtml(c.nome)}</div></div>
      <div><div class="k">CPF/CNPJ</div><div class="v mono">${escapeHtml(c.documento || '—')}</div></div>
      <div><div class="k">Telefone</div><div class="v">${escapeHtml(c.telefone || '—')}</div></div>
      <div><div class="k">WhatsApp</div><div class="v">${escapeHtml(c.whatsapp || '—')}</div></div>
      <div><div class="k">Email</div><div class="v">${escapeHtml(c.email || '—')}</div></div>
      <div><div class="k">CEP</div><div class="v mono">${escapeHtml(c.cep || '—')}</div></div>
      <div><div class="k">Endereço</div><div class="v">${escapeHtml([c.endereco, c.numero, c.bairro].filter(Boolean).join(', ') || '—')}</div></div>
      <div><div class="k">Cidade / Estado</div><div class="v">${escapeHtml(c.cidade || '—')}${c.estado ? ' / ' + escapeHtml(c.estado) : ''}</div></div>
      <div><div class="k">Observações</div><div class="v">${escapeHtml(c.observacoes || '—')}</div></div>
    </div>

    <div class="grid-kpi" style="grid-template-columns:repeat(3,1fr); margin-top:18px;">
      <div class="kpi-card"><span class="kpi-label">Total comprado</span><div class="kpi-value" style="font-size:18px;">${formatBRL(est.total)}</div></div>
      <div class="kpi-card"><span class="kpi-label">Pedidos</span><div class="kpi-value" style="font-size:18px;">${est.quantidade}</div></div>
      <div class="kpi-card"><span class="kpi-label">Ticket médio</span><div class="kpi-value" style="font-size:18px;">${formatBRL(est.ticketMedio)}</div></div>
    </div>

    <div class="detail-section-title">Histórico de pedidos</div>
    ${pedidosHtml}
  `;
  openModal('modal-ver-cliente');
}
