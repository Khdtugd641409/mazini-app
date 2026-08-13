import fs from 'node:fs';

const pagePath = 'src/pages/admin/AdminDashboardPage.jsx';
const cssPath = 'src/pages/admin/AdminDashboardPage.css';

let page = fs.readFileSync(pagePath, 'utf8');
const startMarker = '            <section id="admin-supervisors" className="admin-dashboard-card">';
const endMarker = '            {adminStageWorkspace?.stage && (';
const start = page.indexOf(startMarker);
const end = page.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('Admin supervisor section markers were not found');

const replacement = `            <section id="admin-supervisors" className="admin-dashboard-card">
              <header className="admin-dashboard-card-header">
                <div>
                  <h2>المشرفون والموردون</h2>
                  <p>سجلات المتقدمين والحسابات المعتمدة في المنصة.</p>
                </div>
              </header>

              <div className="admin-partner-directory-grid">
                <button type="button" className="admin-partner-directory-card" onClick={() => { window.location.href = "/admin/supervisor-applications?view=applicants"; }}>
                  <span className="admin-partner-directory-icon">📝</span>
                  <span className="admin-partner-directory-title">المشرفون المتقدمون</span>
                  <span className="admin-partner-directory-note">عرض طلبات التسجيل وسجلات المشرفين المتقدمين</span>
                </button>

                <button type="button" className="admin-partner-directory-card" onClick={() => { window.location.href = "/admin/supervisor-applications?view=approved"; }}>
                  <span className="admin-partner-directory-icon">✅</span>
                  <span className="admin-partner-directory-title">المشرفون المعتمدون</span>
                  <span className="admin-partner-directory-note">عرض سجلات المشرفين المقبولين في المنصة</span>
                </button>

                <button type="button" className="admin-partner-directory-card" onClick={() => { window.location.href = "/admin/supplier-applications?view=applicants"; }}>
                  <span className="admin-partner-directory-icon">📝</span>
                  <span className="admin-partner-directory-title">الموردون المتقدمون</span>
                  <span className="admin-partner-directory-note">عرض طلبات التسجيل وسجلات الموردين المتقدمين</span>
                </button>

                <button type="button" className="admin-partner-directory-card" onClick={() => { window.location.href = "/admin/supplier-applications?view=approved"; }}>
                  <span className="admin-partner-directory-icon">✅</span>
                  <span className="admin-partner-directory-title">الموردون المعتمدون</span>
                  <span className="admin-partner-directory-note">عرض سجلات الموردين المقبولين في المنصة</span>
                </button>
              </div>
            </section>

`;
page = page.slice(0, start) + replacement + page.slice(end);
fs.writeFileSync(pagePath, page);

let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('.admin-partner-directory-grid')) {
  css += `

.admin-partner-directory-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.admin-partner-directory-card {
  display: grid;
  gap: 10px;
  min-height: 150px;
  padding: 20px;
  color: #173f36;
  font: inherit;
  text-align: right;
  cursor: pointer;
  background: linear-gradient(135deg, #fbfaf7, #f3ecdc);
  border: 1px solid #dfd5bd;
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(86, 67, 28, 0.07);
}

.admin-partner-directory-card:hover,
.admin-partner-directory-card:focus-visible {
  transform: translateY(-2px);
  border-color: #b98a2b;
  box-shadow: 0 14px 28px rgba(86, 67, 28, 0.12);
  outline: none;
}

.admin-partner-directory-icon { font-size: 32px; }
.admin-partner-directory-title { font-size: 21px; font-weight: 950; }
.admin-partner-directory-note { color: #687872; line-height: 1.6; }

@media (max-width: 720px) {
  .admin-partner-directory-grid { grid-template-columns: 1fr; }
}
`;
  fs.writeFileSync(cssPath, css);
}
