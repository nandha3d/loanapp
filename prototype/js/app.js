/* ===== LoanTrack — Shared App Logic & Mock Data ===== */

// ── Mock Data Store ──
const MOCK = {
  routes: ['Erode', 'Chithode', 'Gobichettipalayam', 'Bhavani'],
  agents: [
    { id: 'AGT001', name: 'Karthik Rajan', phone: '9876543210', route: 'Erode', role: 'agent' },
    { id: 'AGT002', name: 'Senthil Kumar', phone: '9876543211', route: 'Chithode', role: 'agent' },
    { id: 'AGT003', name: 'Muthu Vel', phone: '9876543212', route: 'Gobichettipalayam', role: 'agent' },
  ],
  customers: [
    { id: 'CUS001', name: 'Rajesh V. Kumar', phone: '9845012345', address: '12, Sathy Rd, Erode', route: 'Erode', agent: 'AGT001', kyc: 'Verified', status: 'Active', aadhar: '8765-4321-0987' },
    { id: 'CUS002', name: 'Lakshmi Devi', phone: '9845012346', address: '45, Gandhi Nagar, Chithode', route: 'Chithode', agent: 'AGT002', kyc: 'Verified', status: 'Active', aadhar: '7654-3210-9876' },
    { id: 'CUS003', name: 'Anand Babu', phone: '9845012347', address: '78, Perundurai Rd, Erode', route: 'Erode', agent: 'AGT001', kyc: 'Pending', status: 'Overdue', aadhar: '6543-2109-8765' },
    { id: 'CUS004', name: 'Meena Kumari', phone: '9845012348', address: '23, Main St, Chithode', route: 'Chithode', agent: 'AGT002', kyc: 'Verified', status: 'Active', aadhar: '5432-1098-7654' },
    { id: 'CUS005', name: 'Suresh Pandi', phone: '9845012349', address: '56, Mettur Rd, Gobichettipalayam', route: 'Gobichettipalayam', agent: 'AGT003', kyc: 'Verified', status: 'Closed', aadhar: '4321-0987-6543' },
    { id: 'CUS006', name: 'Kavitha Selvi', phone: '9845012350', address: '89, Bhavani Rd, Bhavani', route: 'Bhavani', agent: 'AGT003', kyc: 'Verified', status: 'Active', aadhar: '3210-9876-5432' },
    { id: 'CUS007', name: 'Govindaraj M.', phone: '9845012351', address: '34, Chettipalayam, Erode', route: 'Erode', agent: 'AGT001', kyc: 'Verified', status: 'Overdue', aadhar: '2109-8765-4321' },
    { id: 'CUS008', name: 'Priya Nandini', phone: '9845012352', address: '67, Surampatti, Erode', route: 'Erode', agent: 'AGT001', kyc: 'Verified', status: 'Active', aadhar: '1098-7654-3210' },
  ],
  loans: [
    { id: 'LN001', customerId: 'CUS001', principal: 30000, deduction: 3000, disbursed: 27000, frequency: 'Daily', tenure: 100, startDate: '2025-04-01', perInstalment: 300, penaltyRate: 50, status: 'Active', paidCount: 25, totalInstalments: 100 },
    { id: 'LN002', customerId: 'CUS002', principal: 50000, deduction: 5000, disbursed: 45000, frequency: 'Daily', tenure: 100, startDate: '2025-03-15', perInstalment: 500, penaltyRate: 100, status: 'Active', paidCount: 40, totalInstalments: 100 },
    { id: 'LN003', customerId: 'CUS003', principal: 20000, deduction: 2000, disbursed: 18000, frequency: 'Weekly', tenure: 20, startDate: '2025-02-01', perInstalment: 1000, penaltyRate: 200, status: 'Overdue', paidCount: 12, totalInstalments: 20 },
    { id: 'LN004', customerId: 'CUS004', principal: 40000, deduction: 4000, disbursed: 36000, frequency: 'Daily', tenure: 100, startDate: '2025-04-10', perInstalment: 400, penaltyRate: 80, status: 'Active', paidCount: 18, totalInstalments: 100 },
    { id: 'LN005', customerId: 'CUS005', principal: 25000, deduction: 2500, disbursed: 22500, frequency: 'Monthly', tenure: 10, startDate: '2024-06-01', perInstalment: 2500, penaltyRate: 500, status: 'Closed', paidCount: 10, totalInstalments: 10 },
    { id: 'LN006', customerId: 'CUS006', principal: 35000, deduction: 3500, disbursed: 31500, frequency: 'Daily', tenure: 100, startDate: '2025-04-05', perInstalment: 350, penaltyRate: 70, status: 'Active', paidCount: 22, totalInstalments: 100 },
    { id: 'LN007', customerId: 'CUS007', principal: 15000, deduction: 1500, disbursed: 13500, frequency: 'Daily', tenure: 50, startDate: '2025-03-01', perInstalment: 300, penaltyRate: 60, status: 'Overdue', paidCount: 30, totalInstalments: 50 },
  ],
  cheques: [
    { customerId: 'CUS001', bank: 'Indian Bank', chequeNo: 'IB-234567', status: 'Active' },
    { customerId: 'CUS001', bank: 'SBI', chequeNo: 'SBI-890123', status: 'Active' },
    { customerId: 'CUS002', bank: 'Canara Bank', chequeNo: 'CB-456789', status: 'Active' },
    { customerId: 'CUS003', bank: 'IOB', chequeNo: 'IOB-123456', status: 'Returned' },
  ],
  notifications: [
    { id: 1, type: 'warning', icon: 'warning', color: '#F59E0B', text: 'Loan LN003 is 8 days overdue — customer Anand Babu', time: '10 min ago' },
    { id: 2, type: 'info', icon: 'event', color: '#3B82F6', text: 'Loan LN005 closing today for Suresh Pandi', time: '30 min ago' },
    { id: 3, type: 'danger', icon: 'error', color: '#EF4444', text: '3 defaulters detected on Erode route today', time: '1 hr ago' },
    { id: 4, type: 'info', icon: 'person', color: '#3B82F6', text: 'Agent Karthik Rajan has not submitted collections today', time: '2 hrs ago' },
    { id: 5, type: 'success', icon: 'check_circle', color: '#22C55E', text: 'Penalty ₹500 waived for CUS004 by Admin', time: '3 hrs ago' },
  ],
  activities: [
    { time: '09:45 AM', agent: 'Karthik Rajan', customerId: 'CUS001', action: 'Payment logged — ₹300' },
    { time: '09:30 AM', agent: 'Senthil Kumar', customerId: 'CUS002', action: 'Payment logged — ₹500' },
    { time: '09:15 AM', agent: 'Admin', customerId: 'CUS003', action: 'Penalty waived — ₹200' },
    { time: '08:50 AM', agent: 'Karthik Rajan', customerId: 'CUS008', action: 'Payment logged — ₹300' },
    { time: '08:30 AM', agent: 'Admin', customerId: 'CUS006', action: 'New loan created — LN006' },
    { time: 'Yesterday', agent: 'Muthu Vel', customerId: 'CUS006', action: 'Payment logged — ₹350' },
  ],
  penalties: [
    { loanId: 'LN003', customerId: 'CUS003', missedDays: 8, grossPenalty: 1600, settled: 0, waived: 0, status: 'Pending' },
    { loanId: 'LN007', customerId: 'CUS007', missedDays: 5, grossPenalty: 300, settled: 0, waived: 0, status: 'Pending' },
    { loanId: 'LN002', customerId: 'CUS002', missedDays: 2, grossPenalty: 200, settled: 200, waived: 0, status: 'Settled' },
    { loanId: 'LN004', customerId: 'CUS004', missedDays: 1, grossPenalty: 80, settled: 0, waived: 80, status: 'Waived' },
  ],
};

// ── Helpers ──
function fmt(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
function fmtDate(d) { if (!d) return '—'; const dt = new Date(d); return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function todayStr() { return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }); }
function getCustomer(id) { return MOCK.customers.find(c => c.id === id); }
function getLoan(id) { return MOCK.loans.find(l => l.id === id); }
function getAgent(id) { return MOCK.agents.find(a => a.id === id); }
function badgeClass(status) { return 'badge badge-' + status.toLowerCase().replace(/\s/g, ''); }
function getUrlParam(key) { return new URLSearchParams(window.location.search).get(key); }

// ── Sidebar rendering ──
function renderSidebar(activeId) {
  const role = localStorage.getItem('lt_role') || 'admin';
  const nav = [
    { section: 'Main' },
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', href: 'dashboard.html', admin: true },
    { id: 'collection', icon: 'point_of_sale', label: 'Collection Entry', href: 'collection.html' },
    { section: 'Management' },
    { id: 'customers', icon: 'people', label: 'Customers', href: 'customers.html', admin: true },
    { id: 'loans', icon: 'account_balance', label: 'Loans', href: 'loans.html', admin: true },
    { id: 'penalties', icon: 'gavel', label: 'Penalties', href: 'penalties.html', admin: true },
    { section: 'Insights' },
    { id: 'reports', icon: 'bar_chart', label: 'Reports', href: 'reports.html', admin: true },
    { id: 'notifications-page', icon: 'notifications', label: 'Notifications', href: 'notifications.html' },
    { id: 'settings', icon: 'settings', label: 'Settings', href: 'settings.html', admin: true },
  ];
  const user = role === 'admin' ? { name: 'Admin User', initials: 'AU', role: 'Administrator' } : { name: 'Karthik Rajan', initials: 'KR', role: 'Field Agent' };
  let html = `<div class="sidebar-brand"><img src="../assets/logo.svg" alt="LT"><h2>Loan<span>Track</span></h2></div><nav class="sidebar-nav">`;
  nav.forEach(item => {
    if (item.section) { html += `<div class="nav-section">${item.section}</div>`; return; }
    if (item.admin && role !== 'admin') return;
    html += `<a href="${item.href}" class="${item.id === activeId ? 'active' : ''}"><span class="material-icons-outlined">${item.icon}</span>${item.label}</a>`;
  });
  html += `</nav><div class="sidebar-footer"><div class="user-info"><div class="avatar">${user.initials}</div><div><div class="user-name">${user.name}</div><div class="user-role">${user.role}</div></div></div></div>`;
  document.getElementById('sidebar').innerHTML = html;
}

// ── Topbar rendering ──
function renderTopbar(title, breadcrumbs) {
  const bc = breadcrumbs ? breadcrumbs.map((b, i) => i < breadcrumbs.length - 1 ? `<a href="${b.href}">${b.label}</a><span>/</span>` : `<span>${b.label}</span>`).join('') : '';
  document.getElementById('topbar').innerHTML = `
    <div class="topbar-left">
      <button class="btn-menu material-icons-outlined" onclick="document.getElementById('sidebar').classList.toggle('open')">menu</button>
      <div>
        <h2>${title}</h2>
        ${bc ? `<div class="breadcrumb">${bc}</div>` : ''}
      </div>
    </div>
    <div class="topbar-right">
      <span class="topbar-date">${todayStr()}</span>
      <div class="notification-bell" onclick="toggleNotifications()">
        <span class="material-icons-outlined">notifications</span>
        <span class="badge">${MOCK.notifications.length}</span>
        <div class="notification-dropdown" id="notifDropdown">
          <div class="nd-header"><span>Notifications</span><a href="notifications.html" class="btn-ghost btn-sm">View All</a></div>
          ${MOCK.notifications.slice(0, 4).map(n => `<div class="nd-item"><div class="nd-icon" style="background:${n.color}20;color:${n.color}"><span class="material-icons-outlined" style="font-size:16px">${n.icon}</span></div><div><div class="nd-text">${n.text}</div><div class="nd-time">${n.time}</div></div></div>`).join('')}
        </div>
      </div>
      <a href="../index.html" class="btn btn-ghost btn-sm" title="Logout"><span class="material-icons-outlined" style="font-size:20px">logout</span></a>
    </div>`;
}

function toggleNotifications() {
  const dd = document.getElementById('notifDropdown');
  dd.classList.toggle('show');
  event.stopPropagation();
}
document.addEventListener('click', () => { const d = document.getElementById('notifDropdown'); if (d) d.classList.remove('show'); });

// ── Page init helper ──
function initPage(activeId, title, breadcrumbs) {
  renderSidebar(activeId);
  renderTopbar(title, breadcrumbs);
}
