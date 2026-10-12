import React, { useState, useEffect } from 'react';
import { ShieldAlert, Search, Loader2, Download, Printer, Eye, X, Filter, RotateCcw } from 'lucide-react';
import api from '../api/axios';
import { useSettings } from '../context/SettingsContext';
import DatePicker from '../components/DatePicker';
import { generateAuditLogReportHTML } from '../lib/printTemplates';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, totalCount: 0, totalPages: 0 });
  const { settings } = useSettings();

  // Filter States
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Log for JSON Diff Modal
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async (page = 1, filterOverrides) => {
    setLoading(true);
    setError(null);
    try {
      // Allow explicit overrides (used by handleResetFilter to avoid stale closure)
      const filters = filterOverrides || {
        action: actionFilter,
        entityType: entityFilter,
        startDate,
        endDate,
        search
      };

      const params = {
        page,
        limit: pagination.limit,
        action: filters.action !== 'ALL' ? filters.action : undefined,
        entityType: filters.entityType !== 'ALL' ? filters.entityType : undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        search: (filters.search || '').trim() || undefined
      };

      const res = await api.get('/accounting/audit-logs', { params });
      if (res.data?.success) {
        setLogs(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setError('Failed to fetch Audit Logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [pagination.limit]);

  const handleApplyFilter = (e) => {
    e?.preventDefault();
    fetchLogs(1);
  };

  const handleResetFilter = () => {
    setSearch('');
    setActionFilter('ALL');
    setEntityFilter('ALL');
    setStartDate('');
    setEndDate('');
    // Pass cleared values directly to avoid stale closure
    fetchLogs(1, { action: 'ALL', entityType: 'ALL', startDate: '', endDate: '', search: '' });
  };

  // ── Print Audit Log Report ──
  const handlePrint = async () => {
    setExporting(true);
    try {
      const params = {
        all: 'true',
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
        entityType: entityFilter !== 'ALL' ? entityFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search.trim() || undefined
      };
      const res = await api.get('/accounting/audit-logs', { params });
      const printLogs = res.data?.data || logs;

      const filterText = `Scope: Action [${actionFilter}], Table [${entityFilter}], Period [${startDate || 'Start'} to ${endDate || 'Current'}]`;
      const html = generateAuditLogReportHTML({
        logs: printLogs,
        settings,
        filterText
      });

      const printWindow = window.open('', '_blank');
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (err) {
      console.error('Failed to prepare print report:', err);
      alert('Failed to generate printable Audit Report.');
    } finally {
      setExporting(false);
    }
  };

  // ── Export CSV for Auditors ──
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = {
        all: 'true',
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
        entityType: entityFilter !== 'ALL' ? entityFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search.trim() || undefined
      };
      const res = await api.get('/accounting/audit-logs', { params });
      const exportLogs = res.data?.data || logs;

      const headers = ['S.N.', 'Timestamp', 'Action', 'Table/Entity', 'Record ID', 'Performed By', 'Role', 'IP Address', 'Old Data Summary', 'New Data Summary'];
      const csvRows = [headers.join(',')];

      exportLogs.forEach((l, index) => {
        const performedUser = l.performedBy?.name || l.performedBy?.username || l.details?.db_user || 'System';
        const role = l.performedBy?.role || '-';
        const oldStr = l.details?.old ? JSON.stringify(l.details.old).replace(/"/g, '""') : '';
        const newStr = l.details?.new ? JSON.stringify(l.details.new).replace(/"/g, '""') : '';

        const row = [
          index + 1,
          `"${new Date(l.createdAt).toLocaleString()}"`,
          `"${l.action || ''}"`,
          `"${l.entityType || l.tableName || ''}"`,
          `"${l.entityId || l.recordId || ''}"`,
          `"${performedUser.replace(/"/g, '""')}"`,
          `"${role}"`,
          `"${l.ipAddress || 'Internal'}"`,
          `"${oldStr}"`,
          `"${newStr}"`
        ];
        csvRows.push(row.join(','));
      });

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Audit_Logs_Report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export CSV:', err);
      alert('Failed to export Audit Logs CSV.');
    } finally {
      setExporting(false);
    }
  };

  const getActionColor = (action) => {
    if (!action) return 'bg-slate-100 text-slate-700 border-slate-200';
    const act = action.toUpperCase();
    if (act.includes('INSERT')) return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700';
    if (act.includes('UPDATE')) return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700';
    if (act.includes('DELETE')) return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700';
    if (act.includes('RETURN')) return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700';
    if (act.includes('PRINT')) return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700';
    if (act.includes('LOGIN')) return 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700';
    return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
            <ShieldAlert className="w-7 h-7 mr-3 text-brand-500" />
            Transaction Activity & Audit Logs (अडिट लग प्रतिवेदन)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Immutable tracking of all ledger transactions and modifications compliant with IRD Electronic Billing Directives.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={exporting || loading}
            className="flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50 shadow-sm"
          >
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-brand-500" /> : <Download className="w-4 h-4 mr-2 text-slate-500" />}
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            disabled={exporting || loading}
            className="flex items-center px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" /> : <Printer className="w-4 h-4 mr-2" />}
            Print Audit Report
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <form onSubmit={handleApplyFilter} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Search Keyword / ID
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search record ID, entity, user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Action
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              <option value="ALL">All Actions</option>
              <option value="DB_TRIGGER_INSERT">DB_TRIGGER_INSERT</option>
              <option value="DB_TRIGGER_UPDATE">DB_TRIGGER_UPDATE</option>
              <option value="DB_TRIGGER_DELETE">DB_TRIGGER_DELETE</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="LOGIN">LOGIN</option>
              <option value="PRINT_INVOICE">PRINT_INVOICE</option>
              <option value="SALES_RETURN">SALES_RETURN</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Table / Entity
            </label>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              <option value="ALL">All Tables</option>
              <option value="billing_ledger">billing_ledger</option>
              <option value="income_ledger">income_ledger</option>
              <option value="sales_return">sales_return</option>
              <option value="Customer">Customer</option>
              <option value="User">User</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
              From Date
            </label>
            <div className="border border-slate-300 dark:border-slate-600 rounded-lg h-[38px] bg-white dark:bg-slate-900 flex items-center px-2.5 shadow-sm">
              <DatePicker
                name="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-full w-full text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
              To Date
            </label>
            <div className="border border-slate-300 dark:border-slate-600 rounded-lg h-[38px] bg-white dark:bg-slate-900 flex items-center px-2.5 shadow-sm">
              <DatePicker
                name="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-full w-full text-sm outline-none"
              />
            </div>
          </div>

          <div className="lg:col-span-6 flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <button
              type="button"
              onClick={handleResetFilter}
              className="flex items-center px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset Filters
            </button>
            <button
              type="submit"
              className="flex items-center px-4 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition shadow-sm"
            >
              <Filter className="w-3.5 h-3.5 mr-1" />
              Apply Filters
            </button>
          </div>
        </form>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Timestamp</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Action</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Table / Entity</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Record ID</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Performed By</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">IP Address</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Changes Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500 mb-2" />
                    <span className="text-slate-500 dark:text-slate-400">Loading audit logs...</span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-rose-500 dark:text-rose-400">
                    {error}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-500 dark:text-slate-400">
                    No audit records found matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const performedName = log.performedBy?.name || log.performedBy?.username || log.details?.db_user || 'System';
                  const role = log.performedBy?.role;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap text-xs font-mono">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-mono text-xs">
                        {log.entityType || log.tableName}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono text-xs font-semibold">
                        {log.entityId || log.recordId}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 text-xs">
                        <div className="font-medium text-slate-900 dark:text-white">{performedName}</div>
                        {role && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {role}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs font-mono">
                        {log.ipAddress || 'Internal'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="flex items-center text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View Diff
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/50">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Showing Page <span className="font-semibold text-slate-800 dark:text-slate-200">{pagination.page}</span> of{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{pagination.totalPages || 1}</span> ({pagination.totalCount} total audit events)
          </span>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchLogs(pagination.page - 1)}
              className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchLogs(pagination.page + 1)}
              className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* JSON Diff / Details Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${getActionColor(selectedLog.action)}`}>
                  {selectedLog.action}
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Entity: <span className="font-mono text-brand-600 dark:text-brand-400">{selectedLog.entityType || selectedLog.tableName}</span> (ID: {selectedLog.entityId || selectedLog.recordId})
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Sub-info Bar */}
            <div className="px-6 py-3 bg-slate-100/70 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-4">
              <div><strong>Timestamp:</strong> {new Date(selectedLog.createdAt).toLocaleString()}</div>
              <div><strong>Performed By:</strong> {selectedLog.performedBy?.name || selectedLog.performedBy?.username || selectedLog.details?.db_user || 'System'}</div>
              <div><strong>Role:</strong> {selectedLog.performedBy?.role || 'N/A'}</div>
              <div><strong>IP:</strong> {selectedLog.ipAddress || 'Internal'}</div>
            </div>

            {/* Modal Diff Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Old State */}
                <div className="space-y-1.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    Old Data State (Before)
                  </div>
                  <pre className="p-4 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto max-h-96">
                    {selectedLog.details?.old || selectedLog.oldData
                      ? JSON.stringify(selectedLog.details?.old || selectedLog.oldData, null, 2)
                      : 'None (Initial Creation / Insert)'}
                  </pre>
                </div>

                {/* New State */}
                <div className="space-y-1.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    New Data State (After)
                  </div>
                  <pre className="p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto max-h-96">
                    {selectedLog.details?.new || selectedLog.newData
                      ? JSON.stringify(selectedLog.details?.new || selectedLog.newData, null, 2)
                      : (selectedLog.details ? JSON.stringify(selectedLog.details, null, 2) : 'None (Record Deleted)')}
                  </pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

