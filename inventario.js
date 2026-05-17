// ===== STOCKLOCAL — SISTEMA DE INVENTARIO =====
// CRUD completo con localStorage, búsqueda, filtros y alertas

// --- Estado ---
let productos = JSON.parse(localStorage.getItem('stocklocal_productos') || 'null') || [
  { id: 1, nombre: 'Arroz Diana 500g',      categoria: 'Alimentos',  precio: 3500,  stock: 48, minimo: 10, descripcion: 'Arroz blanco premium' },
  { id: 2, nombre: 'Aceite Girasol 1L',     categoria: 'Alimentos',  precio: 8900,  stock: 4,  minimo: 5,  descripcion: 'Aceite vegetal de girasol' },
  { id: 3, nombre: 'Coca-Cola 600ml',       categoria: 'Bebidas',    precio: 2800,  stock: 0,  minimo: 12, descripcion: 'Gaseosa personal' },
  { id: 4, nombre: 'Detergente Fab 500g',   categoria: 'Limpieza',   precio: 5200,  stock: 22, minimo: 8,  descripcion: '' },
  { id: 5, nombre: 'Leche Colanta 1L',      categoria: 'Lácteos',    precio: 3200,  stock: 3,  minimo: 6,  descripcion: 'Leche entera pasteurizada' },
  { id: 6, nombre: 'Pan tajado Bimbo',      categoria: 'Panadería',  precio: 6500,  stock: 15, minimo: 5,  descripcion: '' },
  { id: 7, nombre: 'Shampoo Head & Shoulders', categoria: 'Aseo',   precio: 14900, stock: 9,  minimo: 4,  descripcion: 'Control caspa 400ml' },
  { id: 8, nombre: 'Azúcar blanca 1kg',     categoria: 'Alimentos',  precio: 4100,  stock: 0,  minimo: 8,  descripcion: '' },
];
let nextId = Math.max(0, ...productos.map(p => p.id)) + 1;
let editingId = null;
let modalProductoId = null;

// --- Persistencia ---
function save() {
  localStorage.setItem('stocklocal_productos', JSON.stringify(productos));
}

// --- Navegación ---
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('section-' + name).classList.remove('hidden');
  document.querySelector(`[onclick="showSection('${name}')"]`).classList.add('active');

  if (name === 'dashboard') renderDashboard();
  if (name === 'productos') renderProductos();
  if (name === 'agregar' && !editingId) resetForm();
  if (name === 'alertas') renderAlertas();
}

// --- Helpers ---
function getEstado(p) {
  if (p.stock === 0) return 'agotado';
  if (p.stock <= (p.minimo || 5)) return 'bajo';
  return 'normal';
}

function estadoLabel(estado) {
  const map = { normal: 'Normal', bajo: 'Stock bajo', agotado: 'Agotado' };
  return map[estado] || estado;
}

function formatCOP(n) {
  return '$' + Number(n).toLocaleString('es-CO');
}

function getCategorias() {
  return [...new Set(productos.map(p => p.categoria))].sort();
}

// --- Dashboard ---
function renderDashboard() {
  const total    = productos.length;
  const valorTotal = productos.reduce((acc, p) => acc + p.precio * p.stock, 0);
  const bajo     = productos.filter(p => getEstado(p) === 'bajo').length;
  const agotado  = productos.filter(p => getEstado(p) === 'agotado').length;

  document.getElementById('kpi-total').textContent   = total;
  document.getElementById('kpi-valor').textContent   = formatCOP(valorTotal);
  document.getElementById('kpi-bajo').textContent    = bajo;
  document.getElementById('kpi-agotado').textContent = agotado;

  const recientes = [...productos].slice(0, 5);
  const tbody = document.getElementById('tbody-recientes');
  tbody.innerHTML = recientes.map(p => rowHTML(p, false)).join('');
  updateBadge();
}

// --- Productos ---
function renderProductos() {
  const q    = (document.getElementById('search-input').value || '').toLowerCase();
  const cat  = document.getElementById('filter-categoria').value;
  const est  = document.getElementById('filter-estado').value;

  // Actualizar datalist categorías
  const datalist = document.getElementById('cat-list');
  const catSelect = document.getElementById('filter-categoria');
  const cats = getCategorias();
  datalist.innerHTML = cats.map(c => `<option value="${c}">`).join('');
  const currentCat = catSelect.value;
  catSelect.innerHTML = '<option value="">Todas las categorías</option>' +
    cats.map(c => `<option value="${c}" ${c === currentCat ? 'selected' : ''}>${c}</option>`).join('');

  let visible = productos.filter(p => {
    const matchQ   = !q   || p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q);
    const matchCat = !cat || p.categoria === cat;
    const matchEst = !est || getEstado(p) === est;
    return matchQ && matchCat && matchEst;
  });

  const tbody = document.getElementById('tbody-productos');
  const empty = document.getElementById('empty-products');

  if (visible.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    tbody.innerHTML = visible.map(p => rowHTML(p, true)).join('');
  }
}

function rowHTML(p, acciones) {
  const estado = getEstado(p);
  const valorTotal = formatCOP(p.precio * p.stock);
  return `
    <tr>
      <td>
        <div class="prod-name">${escapeHtml(p.nombre)}</div>
        ${p.descripcion ? `<div class="prod-desc">${escapeHtml(p.descripcion)}</div>` : ''}
      </td>
      <td>${escapeHtml(p.categoria)}</td>
      <td><strong>${p.stock}</strong></td>
      <td>${formatCOP(p.precio)}</td>
      ${acciones ? `<td>${valorTotal}</td>` : ''}
      <td><span class="status status-${estado}">${estadoLabel(estado)}</span></td>
      ${acciones ? `
      <td>
        <div class="action-btns">
          <button class="btn-icon" onclick="abrirModal(${p.id})" title="Ajustar stock">±</button>
          <button class="btn-icon" onclick="editarProducto(${p.id})" title="Editar">✎</button>
          <button class="btn-icon danger" onclick="eliminarProducto(${p.id})" title="Eliminar">✕</button>
        </div>
      </td>` : ''}
    </tr>`;
}

// --- Agregar / Editar ---
function guardarProducto() {
  const nombre     = document.getElementById('f-nombre').value.trim();
  const categoria  = document.getElementById('f-categoria').value.trim();
  const precio     = parseFloat(document.getElementById('f-precio').value);
  const stock      = parseInt(document.getElementById('f-stock').value);
  const minimo     = parseInt(document.getElementById('f-minimo').value) || 5;
  const descripcion = document.getElementById('f-descripcion').value.trim();
  const errorEl    = document.getElementById('form-error');

  if (!nombre || !categoria || isNaN(precio) || isNaN(stock)) {
    errorEl.classList.remove('hidden');
    return;
  }
  errorEl.classList.add('hidden');

  if (editingId) {
    const p = productos.find(p => p.id === editingId);
    if (p) { p.nombre = nombre; p.categoria = categoria; p.precio = precio; p.stock = stock; p.minimo = minimo; p.descripcion = descripcion; }
    editingId = null;
  } else {
    productos.unshift({ id: nextId++, nombre, categoria, precio, stock, minimo, descripcion });
  }

  save();
  resetForm();
  updateBadge();
  showSection('productos');
}

function editarProducto(id) {
  const p = productos.find(p => p.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById('form-title').textContent = 'Editar producto';
  document.getElementById('f-nombre').value      = p.nombre;
  document.getElementById('f-categoria').value   = p.categoria;
  document.getElementById('f-precio').value      = p.precio;
  document.getElementById('f-stock').value       = p.stock;
  document.getElementById('f-minimo').value      = p.minimo;
  document.getElementById('f-descripcion').value = p.descripcion || '';
  showSection('agregar');
}

function cancelarEdicion() {
  editingId = null;
  resetForm();
  showSection('productos');
}

function resetForm() {
  editingId = null;
  document.getElementById('form-title').textContent = 'Agregar producto';
  ['f-nombre','f-categoria','f-precio','f-stock','f-minimo','f-descripcion'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('form-error').classList.add('hidden');
}

// --- Eliminar ---
function eliminarProducto(id) {
  if (!confirm('¿Seguro que deseas eliminar este producto?')) return;
  productos = productos.filter(p => p.id !== id);
  save();
  updateBadge();
  renderProductos();
}

// --- Modal ajuste stock ---
function abrirModal(id) {
  const p = productos.find(p => p.id === id);
  if (!p) return;
  modalProductoId = id;
  document.getElementById('modal-nombre').textContent = p.nombre;
  document.getElementById('modal-stock').value = p.stock;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function cerrarModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  modalProductoId = null;
}

function ajustarStock(delta) {
  const input = document.getElementById('modal-stock');
  const val = Math.max(0, (parseInt(input.value) || 0) + delta);
  input.value = val;
}

function guardarStock() {
  const p = productos.find(p => p.id === modalProductoId);
  if (p) {
    p.stock = Math.max(0, parseInt(document.getElementById('modal-stock').value) || 0);
    save();
    updateBadge();
    renderProductos();
  }
  cerrarModal();
}

// --- Alertas ---
function renderAlertas() {
  const alertas = productos.filter(p => getEstado(p) !== 'normal');
  const container = document.getElementById('alertas-list');

  if (alertas.length === 0) {
    container.innerHTML = '<div class="empty-alertas">✅ Todo el inventario está en buen estado</div>';
    return;
  }

  container.innerHTML = alertas.map(p => {
    const estado = getEstado(p);
    return `
      <div class="alerta-card ${estado === 'agotado' ? 'agotado' : ''}">
        <div class="alerta-info">
          <div class="alerta-nombre">${escapeHtml(p.nombre)}</div>
          <div class="alerta-detalle">
            ${estado === 'agotado'
              ? 'Producto agotado — requiere reabastecimiento urgente'
              : `Stock actual: ${p.stock} unid. (mínimo: ${p.minimo})`}
          </div>
        </div>
        <span class="status status-${estado}">${estadoLabel(estado)}</span>
        <button class="btn-icon" onclick="abrirModal(${p.id})">Ajustar ±</button>
      </div>`;
  }).join('');
}

function updateBadge() {
  const count = productos.filter(p => getEstado(p) !== 'normal').length;
  const badge = document.getElementById('badge-alertas');
  badge.textContent = count;
  count > 0 ? badge.classList.add('visible') : badge.classList.remove('visible');
}

// --- Seguridad XSS ---
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Init ---
renderDashboard();
updateBadge();
