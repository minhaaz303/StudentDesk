const $ = id => document.getElementById(id);
let token = localStorage.getItem('studentdesk_token');
let user = null;
let students = [];
let allStudents = [];
let mode = 'login';
let searchTimer;

function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); }
function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Something went wrong.');
  return data;
}
function showAuth() { $('dashboard').classList.add('hidden'); $('authPage').classList.remove('hidden'); }
function setMode(next) {
  mode = next; const register = mode === 'register';
  $('authTitle').innerHTML = register ? 'Create your account<span class="period">.</span>' : 'Welcome back<span class="period">.</span>';
  $('authSubtitle').textContent = register ? 'Set up your secure student records workspace.' : 'Sign in to manage your student records.';
  $('nameWrap').classList.toggle('hidden', !register); $('nameInput').required = register;
  $('submitAuth').innerHTML = register ? 'Create workspace <span>↗</span>' : 'Sign in <span>↗</span>';
  $('switchPrompt').textContent = register ? 'Already have an account?' : 'New to StudentDesk?';
  $('switchMode').innerHTML = register ? 'Sign in <span>↗</span>' : 'Create an account <span>↗</span>';
  $('passwordInput').autocomplete = register ? 'new-password' : 'current-password'; $('authError').textContent = '';
}
function showDashboard() { $('authPage').classList.add('hidden'); $('dashboard').classList.remove('hidden'); }
async function checkDatabase() {
  try {
    const health = await fetch('/api/health').then(response => response.json());
    $('databaseNotice').classList.toggle('hidden', health.database === 'connected');
    if (health.database === 'disconnected') setTimeout(checkDatabase, 5000);
  } catch { $('databaseNotice').classList.remove('hidden'); setTimeout(checkDatabase, 5000); }
}
function renderUser() {
  const first = user.name.trim().split(/\s+/)[0];
  $('userName').textContent = user.name; $('avatar').textContent = first[0].toUpperCase(); $('firstName').textContent = first;
  const hour = new Date().getHours();
  document.querySelector('.page-heading h1').firstChild.textContent = `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, `;
  $('todayLabel').textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}
function formatDate(date) { if (!date) return '—'; const d = new Date(`${date}T00:00:00`); return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function initials(name) { return String(name || '?').split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase(); }
function renderStudents() {
  const active = allStudents.filter(student => student.status === 'Active').length;
  const leave = allStudents.filter(student => student.status === 'On leave').length;
  const programs = new Set(allStudents.map(student => student.course.trim().toLowerCase()).filter(Boolean)).size;
  $('totalStudents').textContent = String(allStudents.length).padStart(2, '0'); $('activeStudents').textContent = String(active).padStart(2, '0');
  $('leaveStudents').textContent = String(leave).padStart(2, '0'); $('programCount').textContent = String(programs).padStart(2, '0'); $('navCount').textContent = students.length;
  $('resultCount').textContent = `${students.length} STUDENT${students.length === 1 ? '' : 'S'}`;
  const isSearch = $('searchInput').value.trim() || $('statusFilter').value !== 'All statuses';
  $('emptyState').style.display = students.length ? 'none' : 'block';
  $('emptyTitle').textContent = isSearch ? 'No students match your search.' : 'Your student records start here.';
  $('emptyMessage').textContent = isSearch ? 'Try a different name, ID, course, or status.' : 'Add a student to build a clearer picture of your community.';
  $('emptyAddBtn').style.display = isSearch ? 'none' : 'inline-flex';
  $('studentRows').innerHTML = students.map(student => {
    const statusClass = student.status === 'Active' ? 'status-active' : student.status === 'On leave' ? 'status-leave' : 'status-graduated';
    return `<tr><td><div class="student-cell"><span class="student-avatar">${escapeHtml(initials(student.name))}</span><span><b>${escapeHtml(student.name)}</b><small>${escapeHtml(student.email || 'No email added')}</small></span></div></td><td><span class="id-cell">${escapeHtml(student.studentId)}</span></td><td>${escapeHtml(student.course)}</td><td>${escapeHtml(student.year)}</td><td><span class="status-pill ${statusClass}">${escapeHtml(student.status)}</span></td><td><div class="row-actions"><button class="row-action" data-view="${student._id}" title="View details" aria-label="View ${escapeHtml(student.name)}">↗</button><button class="row-action" data-edit="${student._id}" title="Edit student" aria-label="Edit ${escapeHtml(student.name)}">✎</button><button class="row-action" data-delete="${student._id}" title="Delete student" aria-label="Delete ${escapeHtml(student.name)}">×</button></div></td></tr>`;
  }).join('');
  $('studentRows').querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => viewStudent(button.dataset.view)));
  $('studentRows').querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => editStudent(button.dataset.edit)));
  $('studentRows').querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => deleteStudent(button.dataset.delete)));
}
async function loadStudents(refreshSummary = true) {
  const params = new URLSearchParams();
  if ($('searchInput').value.trim()) params.set('search', $('searchInput').value.trim());
  if ($('statusFilter').value !== 'All statuses') params.set('status', $('statusFilter').value);
  try {
    const requests = [api(`/students?${params}`)];
    if (refreshSummary) requests.push(api('/students'));
    const result = await Promise.all(requests);
    students = result[0]; if (refreshSummary) allStudents = result[1]; renderStudents();
  }
  catch (error) { if (error.message.includes('session')) logout(); else toast(error.message); }
}
async function openDashboard() { const result = await api('/auth/me'); user = result.user; renderUser(); await loadStudents(); showDashboard(); }
function clearStudentForm() { $('studentForm').reset(); $('studentRecordId').value = ''; $('studentStatus').value = 'Active'; $('studentFormError').textContent = ''; }
function addStudent() { clearStudentForm(); $('studentModalTitle').innerHTML = 'Add a student<span class="period">.</span>'; $('studentDialog').showModal(); }
function fillForm(student) {
  $('studentRecordId').value = student._id; $('studentName').value = student.name || ''; $('studentId').value = student.studentId || ''; $('studentEmail').value = student.email || ''; $('studentPhone').value = student.phone || ''; $('studentCourse').value = student.course || ''; $('studentYear').value = student.year || ''; $('studentStatus').value = student.status || 'Active'; $('studentDob').value = student.dateOfBirth || ''; $('studentGender').value = student.gender || ''; $('studentGuardian').value = student.guardian || ''; $('studentAddress').value = student.address || ''; $('studentNotes').value = student.notes || '';
}
function editStudent(id) { const student = students.find(item => item._id === id); if (!student) return; clearStudentForm(); fillForm(student); $('studentModalTitle').innerHTML = 'Update student<span class="period">.</span>'; $('studentDialog').showModal(); }
function detailField(label, value, wide = false) { return `<div class="detail-item${wide ? ' wide' : ''}"><span>${label}</span><b>${escapeHtml(value || '—')}</b></div>`; }
function viewStudent(id) {
  const student = students.find(item => item._id === id); if (!student) return;
  $('detailName').innerHTML = `${escapeHtml(student.name)}<span class="period">.</span>`; $('detailId').textContent = `STUDENT ID · ${student.studentId}`;
  $('detailBody').innerHTML = detailField('EMAIL ADDRESS', student.email) + detailField('PHONE NUMBER', student.phone) + detailField('COURSE / PROGRAM', student.course) + detailField('ACADEMIC YEAR', student.year) + detailField('ENROLLMENT STATUS', student.status) + detailField('DATE OF BIRTH', formatDate(student.dateOfBirth)) + detailField('GENDER', student.gender) + detailField('PARENT / GUARDIAN', student.guardian) + detailField('ADDRESS', student.address, true) + detailField('NOTES', student.notes, true);
  $('detailEditBtn').onclick = () => { $('detailDialog').close(); editStudent(student._id); }; $('detailDialog').showModal();
}
async function deleteStudent(id) {
  const student = students.find(item => item._id === id); if (!student || !confirm(`Delete ${student.name}'s record? This cannot be undone.`)) return;
  try { await api(`/students/${id}`, { method: 'DELETE' }); students = students.filter(item => item._id !== id); renderStudents(); toast('Student record deleted.'); }
  catch (error) { toast(error.message); }
}
function logout() { token = null; user = null; localStorage.removeItem('studentdesk_token'); $('authForm').reset(); setMode('login'); showAuth(); }

$('switchMode').addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));
$('authForm').addEventListener('submit', async event => {
  event.preventDefault(); $('authError').textContent = ''; $('submitAuth').disabled = true;
  const body = { email: $('emailInput').value, password: $('passwordInput').value }; if (mode === 'register') body.name = $('nameInput').value;
  try { const result = await api(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) }); token = result.token; user = result.user; localStorage.setItem('studentdesk_token', token); await openDashboard(); }
  catch (error) { $('authError').textContent = error.message; }
  finally { $('submitAuth').disabled = false; }
});
$('logoutBtn').addEventListener('click', logout);
['topAddBtn', 'sectionAddBtn', 'emptyAddBtn'].forEach(id => $(id).addEventListener('click', addStudent));
$('searchInput').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadStudents(false), 220); });
$('statusFilter').addEventListener('change', () => loadStudents(false));
$('studentForm').addEventListener('submit', async event => {
  event.preventDefault(); $('studentFormError').textContent = '';
  const id = $('studentRecordId').value;
  const body = { studentId: $('studentId').value, name: $('studentName').value, email: $('studentEmail').value, phone: $('studentPhone').value, course: $('studentCourse').value, year: $('studentYear').value, status: $('studentStatus').value, dateOfBirth: $('studentDob').value, gender: $('studentGender').value, guardian: $('studentGuardian').value, address: $('studentAddress').value, notes: $('studentNotes').value };
  try { await api(`/students${id ? `/${id}` : ''}`, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) }); $('studentDialog').close(); await loadStudents(); toast(id ? 'Student details updated.' : 'Student added to your database.'); }
  catch (error) { $('studentFormError').textContent = error.message; }
});
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
if (token) openDashboard().catch(() => { token = null; localStorage.removeItem('studentdesk_token'); showAuth(); }); else showAuth();
checkDatabase();
