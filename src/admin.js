/* ==========================================================================
   GOURMET COLA ADMIN PORTAL & SINGLE-SLOT ENGINE
   ========================================================================== */

import {
  checkAdminSlotStatus,
  registerAdminSlot,
  verifyAdminLogin,
  fetchOrders,
  updateOrderStatus
} from './supabase.js';

let currentAdminSession = null;
let cachedOrders = [];
let slotIsOccupied = false;

/* --------------------------------------------------------------------------
   INITIALIZATION & EVENT BINDINGS
   -------------------------------------------------------------------------- */
export function initAdminPortal() {
  const openLink = document.getElementById('open-admin-link');
  const closeBtn = document.getElementById('close-admin-modal-btn');
  const modal = document.getElementById('admin-modal');

  if (openLink) {
    openLink.addEventListener('click', openAdminModal);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeAdminModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAdminModal();
    });
  }

  // Auth Tabs
  const loginTabBtn = document.getElementById('tab-login-btn');
  const signupTabBtn = document.getElementById('tab-signup-btn');
  const switchToLoginBtn = document.getElementById('switch-to-login-btn');

  if (loginTabBtn) loginTabBtn.addEventListener('click', () => switchTab('login'));
  if (signupTabBtn) signupTabBtn.addEventListener('click', () => switchTab('signup'));
  if (switchToLoginBtn) switchToLoginBtn.addEventListener('click', () => switchTab('login'));

  // Auth Forms
  const loginForm = document.getElementById('admin-login-form');
  const signupForm = document.getElementById('admin-signup-form');

  if (loginForm) loginForm.addEventListener('submit', handleAdminLogin);
  if (signupForm) signupForm.addEventListener('submit', handleAdminSignup);

  // Dashboard Controls
  const refreshBtn = document.getElementById('admin-refresh-btn');
  const logoutBtn = document.getElementById('admin-logout-btn');
  const searchInput = document.getElementById('admin-search-input');
  const statusFilter = document.getElementById('admin-status-filter');
  const exportCsvBtn = document.getElementById('admin-export-csv');

  if (refreshBtn) refreshBtn.addEventListener('click', () => refreshDashboard());
  if (logoutBtn) logoutBtn.addEventListener('click', handleAdminLogout);
  if (searchInput) searchInput.addEventListener('input', renderFilteredOrdersTable);
  if (statusFilter) statusFilter.addEventListener('change', renderFilteredOrdersTable);
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportOrdersToCSV);

  // Check stored session
  const storedSession = sessionStorage.getItem('gourmet_admin_session');
  if (storedSession) {
    try {
      currentAdminSession = JSON.parse(storedSession);
    } catch (e) {
      currentAdminSession = null;
    }
  }

  // Initial slot check
  updateSlotStatusUI();
}

/* --------------------------------------------------------------------------
   MODAL DISPLAY & SLOT STATUS
   -------------------------------------------------------------------------- */
export async function openAdminModal() {
  const modal = document.getElementById('admin-modal');
  if (!modal) return;

  modal.classList.remove('hidden');

  await updateSlotStatusUI();

  if (currentAdminSession) {
    showDashboardView();
  } else {
    showAuthView();
  }
}

export function closeAdminModal() {
  const modal = document.getElementById('admin-modal');
  if (modal) modal.classList.add('hidden');
}

// Global window bindings
window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.switchAdminTab = switchTab;

async function updateSlotStatusUI() {
  const badge = document.getElementById('admin-slot-badge');
  const badgeText = document.getElementById('admin-slot-text');
  const signupTabBtn = document.getElementById('tab-signup-btn');
  const lockedNotice = document.getElementById('admin-slot-locked-notice');
  const signupForm = document.getElementById('admin-signup-form');

  try {
    const status = await checkAdminSlotStatus();
    slotIsOccupied = status.exists;

    if (slotIsOccupied) {
      if (badge) {
        badge.className = 'admin-slot-badge slot-filled';
      }
      if (badgeText) {
        badgeText.textContent = '🔒 Admin Slot Filled (1/1 Registered) — Registration Closed';
      }
      if (signupTabBtn) {
        signupTabBtn.textContent = '🔒 Registration Locked';
      }
      if (lockedNotice) lockedNotice.classList.remove('hidden');
      if (signupForm) signupForm.classList.add('hidden');
    } else {
      if (badge) {
        badge.className = 'admin-slot-badge slot-available';
      }
      if (badgeText) {
        badgeText.textContent = '🟢 1 Slot Available — Register Master Admin Account';
      }
      if (signupTabBtn) {
        signupTabBtn.textContent = '✨ Create Admin Account (1 Slot)';
      }
      if (lockedNotice) lockedNotice.classList.add('hidden');
      if (signupForm) signupForm.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Error checking admin slot status:', err);
  }
}

/* --------------------------------------------------------------------------
   VIEW SWITCHING (AUTH VS DASHBOARD / LOGIN VS SIGNUP)
   -------------------------------------------------------------------------- */
function showAuthView() {
  document.getElementById('admin-auth-view')?.classList.remove('hidden');
  document.getElementById('admin-dashboard-view')?.classList.add('hidden');

  // If slot occupied, default to login tab; if available and first open, signup tab can be selected
  if (slotIsOccupied) {
    switchTab('login');
  } else {
    switchTab('signup');
  }
}

function showDashboardView() {
  document.getElementById('admin-auth-view')?.classList.add('hidden');
  document.getElementById('admin-dashboard-view')?.classList.remove('hidden');

  // Set header admin details
  const nameEl = document.getElementById('dash-admin-name');
  const emailEl = document.getElementById('dash-admin-email');
  if (nameEl && currentAdminSession) nameEl.textContent = `Welcome, ${currentAdminSession.name || 'Admin'}`;
  if (emailEl && currentAdminSession) emailEl.textContent = currentAdminSession.email || '';

  refreshDashboard();
}

function switchTab(tabName) {
  const loginTab = document.getElementById('admin-login-tab');
  const signupTab = document.getElementById('admin-signup-tab');
  const loginBtn = document.getElementById('tab-login-btn');
  const signupBtn = document.getElementById('tab-signup-btn');

  if (tabName === 'login') {
    loginTab?.classList.remove('hidden');
    signupTab?.classList.add('hidden');
    loginBtn?.classList.add('active');
    signupBtn?.classList.remove('active');
  } else {
    // If slot is occupied, warn user
    if (slotIsOccupied) {
      document.getElementById('admin-slot-locked-notice')?.classList.remove('hidden');
      document.getElementById('admin-signup-form')?.classList.add('hidden');
    }
    signupTab?.classList.remove('hidden');
    loginTab?.classList.add('hidden');
    signupBtn?.classList.add('active');
    loginBtn?.classList.remove('active');
  }
}

/* --------------------------------------------------------------------------
   AUTHENTICATION LOGIC (SIGNUP & LOGIN)
   -------------------------------------------------------------------------- */
async function handleAdminSignup(e) {
  e.preventDefault();

  const nameInput = document.getElementById('admin-signup-name');
  const emailInput = document.getElementById('admin-signup-email');
  const passInput = document.getElementById('admin-signup-pass');
  const confirmInput = document.getElementById('admin-signup-confirm');
  const errBox = document.getElementById('admin-signup-error');
  const submitBtn = document.getElementById('admin-signup-submit');

  errBox.classList.add('hidden');

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passInput.value;
  const confirmPass = confirmInput.value;

  if (password !== confirmPass) {
    errBox.textContent = '⚠️ Passwords do not match. Please check and try again.';
    errBox.classList.remove('hidden');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ Registering Master Account...';

  try {
    const admin = await registerAdminSlot({ name, email, password });

    // Success! Store session
    currentAdminSession = admin;
    sessionStorage.setItem('gourmet_admin_session', JSON.stringify(admin));

    // Update slot UI to locked immediately
    await updateSlotStatusUI();

    // Show dashboard
    showDashboardView();

  } catch (err) {
    errBox.textContent = `⚠️ Registration failed: ${err.message || err}`;
    errBox.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '🛡️ Register & Claim Admin Slot';
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();

  const emailInput = document.getElementById('admin-login-email');
  const passInput = document.getElementById('admin-login-password');
  const errBox = document.getElementById('admin-login-error');
  const submitBtn = document.getElementById('admin-login-submit');

  errBox.classList.add('hidden');

  const emailOrUser = emailInput.value.trim();
  const password = passInput.value;

  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ Authenticating...';

  try {
    const admin = await verifyAdminLogin(emailOrUser, password);

    currentAdminSession = admin;
    sessionStorage.setItem('gourmet_admin_session', JSON.stringify(admin));

    showDashboardView();

  } catch (err) {
    errBox.textContent = `⚠️ Login failed: ${err.message || err}`;
    errBox.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '🚀 Log In to Admin Dashboard';
  }
}

function handleAdminLogout() {
  currentAdminSession = null;
  sessionStorage.removeItem('gourmet_admin_session');
  showAuthView();
}

/* --------------------------------------------------------------------------
   DASHBOARD & BOOKINGS MANAGEMENT
   -------------------------------------------------------------------------- */
export async function refreshDashboard() {
  const refreshBtn = document.getElementById('admin-refresh-btn');
  if (refreshBtn) refreshBtn.textContent = '⏳ Refreshing...';

  try {
    cachedOrders = await fetchOrders();
    updateMetrics(cachedOrders);
    renderFilteredOrdersTable();
  } catch (err) {
    console.error('Failed to load orders:', err);
  } finally {
    if (refreshBtn) refreshBtn.textContent = '🔄 Refresh Data';
  }
}

function updateMetrics(orders) {
  const totalCount = orders.length;
  let revenue = 0;
  let pendingCount = 0;
  let completedCount = 0;

  orders.forEach(o => {
    const qty = parseInt(o.quantity || 1, 10);
    const price = parseFloat(o.pack_price || 0);
    revenue += (qty * price);

    const st = (o.status || 'Pending').toLowerCase();
    if (st === 'pending') pendingCount++;
    if (st === 'completed') completedCount++;
  });

  const mTotal = document.getElementById('metric-total-orders');
  const mRev = document.getElementById('metric-total-revenue');
  const mPend = document.getElementById('metric-pending-orders');
  const mComp = document.getElementById('metric-completed-orders');

  if (mTotal) mTotal.textContent = totalCount;
  if (mRev) mRev.textContent = `Rs. ${revenue.toLocaleString()}`;
  if (mPend) mPend.textContent = pendingCount;
  if (mComp) mComp.textContent = completedCount;
}

function renderFilteredOrdersTable() {
  const tbody = document.getElementById('admin-orders-tbody');
  const emptyState = document.getElementById('admin-table-empty');
  const emptyText = document.getElementById('empty-state-text');
  const searchVal = (document.getElementById('admin-search-input')?.value || '').toLowerCase().trim();
  const filterVal = document.getElementById('admin-status-filter')?.value || 'ALL';

  if (!tbody) return;

  tbody.innerHTML = '';

  const filtered = cachedOrders.filter(o => {
    // Status Filter
    const st = o.status || 'Pending';
    if (filterVal !== 'ALL' && st.toLowerCase() !== filterVal.toLowerCase()) {
      return false;
    }

    // Search query
    if (searchVal) {
      const haystack = [
        o.id,
        o.full_name,
        o.email,
        o.phone,
        o.city,
        o.address,
        o.pack_type,
        o.notes
      ].map(v => (v || '').toString().toLowerCase()).join(' ');

      if (!haystack.includes(searchVal)) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    if (emptyText) {
      emptyText.textContent = cachedOrders.length === 0
        ? 'No bookings found yet. Placed orders will appear here in real time.'
        : 'No bookings match your current search or filter criteria.';
    }
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  filtered.forEach(o => {
    const tr = document.createElement('tr');

    const formattedDate = o.created_at
      ? new Date(o.created_at).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'N/A';

    const qty = parseInt(o.quantity || 1, 10);
    const packPrice = parseFloat(o.pack_price || 0);
    const totalPrice = qty * packPrice;
    const currentStatus = o.status || 'Pending';

    const statusBadgeClass = `status-badge badge-${currentStatus.toLowerCase()}`;

    tr.innerHTML = `
      <td>
        <span class="order-id-code">#${(o.id || '').substring(0, 12)}</span>
        <span class="order-date-time">📅 ${formattedDate}</span>
      </td>
      <td>
        <span class="cust-name">👤 ${escapeHtml(o.full_name || 'N/A')}</span>
        <span class="cust-email">✉️ ${escapeHtml(o.email || 'N/A')}</span>
        <span class="cust-phone">📞 ${escapeHtml(o.phone || 'N/A')}</span>
      </td>
      <td>
        <span class="cust-name">📍 ${escapeHtml(o.city || 'N/A')}</span>
        <span class="cust-email">${escapeHtml(o.address || 'N/A')}</span>
        ${o.notes ? `<span class="cust-phone">📝 <em>${escapeHtml(o.notes)}</em></span>` : ''}
      </td>
      <td>
        <span class="cust-name">${escapeHtml(o.pack_type || 'Pack')}</span>
        <span class="cust-email">Qty: ${qty} unit(s)</span>
      </td>
      <td>
        <span class="cust-name" style="color: #ffd700;">Rs. ${totalPrice.toLocaleString()}</span>
        <span class="cust-email">(Rs. ${packPrice}/unit)</span>
      </td>
      <td>
        <span class="${statusBadgeClass}" id="badge-${o.id}">${currentStatus}</span>
      </td>
      <td>
        <select class="status-inline-select" data-order-id="${o.id}">
          <option value="Pending" ${currentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Processing" ${currentStatus === 'Processing' ? 'selected' : ''}>Processing</option>
          <option value="Completed" ${currentStatus === 'Completed' ? 'selected' : ''}>Completed</option>
          <option value="Cancelled" ${currentStatus === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
    `;

    // Bind inline status change event
    const statusSelect = tr.querySelector('.status-inline-select');
    if (statusSelect) {
      statusSelect.addEventListener('change', async (e) => {
        const newSt = e.target.value;
        await handleStatusChange(o.id, newSt);
      });
    }

    tbody.appendChild(tr);
  });
}

async function handleStatusChange(orderId, newStatus) {
  // Update local model
  const target = cachedOrders.find(o => o.id === orderId);
  if (target) {
    target.status = newStatus;
  }

  // Save via Supabase & local storage
  await updateOrderStatus(orderId, newStatus);

  // Update Metrics & UI
  updateMetrics(cachedOrders);
  renderFilteredOrdersTable();
}

function exportOrdersToCSV() {
  if (!cachedOrders || cachedOrders.length === 0) {
    alert('No order data available to export.');
    return;
  }

  const headers = [
    'Order ID',
    'Date Created',
    'Full Name',
    'Email',
    'Phone',
    'City',
    'Address',
    'Pack Type',
    'Quantity',
    'Unit Price (PKR)',
    'Total Amount (PKR)',
    'Status',
    'Notes'
  ];

  const rows = cachedOrders.map(o => {
    const qty = parseInt(o.quantity || 1, 10);
    const price = parseFloat(o.pack_price || 0);
    return [
      `"${o.id || ''}"`,
      `"${o.created_at || ''}"`,
      `"${(o.full_name || '').replace(/"/g, '""')}"`,
      `"${(o.email || '').replace(/"/g, '""')}"`,
      `"${(o.phone || '').replace(/"/g, '""')}"`,
      `"${(o.city || '').replace(/"/g, '""')}"`,
      `"${(o.address || '').replace(/"/g, '""')}"`,
      `"${(o.pack_type || '').replace(/"/g, '""')}"`,
      qty,
      price,
      qty * price,
      `"${o.status || 'Pending'}"`,
      `"${(o.notes || '').replace(/"/g, '""')}"`
    ];
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `gourmet_cola_bookings_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
