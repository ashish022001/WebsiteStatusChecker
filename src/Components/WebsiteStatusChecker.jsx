import React, { useState, useEffect, useMemo } from 'react';
import { Upload, Download, Globe, CheckCircle, XCircle, AlertTriangle, RefreshCw, FileText, Search, Filter, Eye, EyeOff, BarChart3, Clock, Zap, AlertCircle, Info } from 'lucide-react';

const WebsiteStatusChecker = () => {
  const [domains, setDomains] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [summary, setSummary] = useState({ active: 0, inactive: 0, error: 0, redirects: 0, other: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  const [retryCount, setRetryCount] = useState({});
  const [selectedDomains, setSelectedDomains] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');

  // You can change this URL based on your server setup
  const API_BASE_URL = 'http://65.2.57.231:5000';

  // Enhanced filtering and search
  const filteredResults = useMemo(() => {
    let filtered = results.filter(result => {
      const matchesSearch = result.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.message.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'success' && result.status_code >= 200 && result.status_code < 300) ||
        (statusFilter === 'redirect' && result.status_code >= 300 && result.status_code < 400) ||
        (statusFilter === 'client-error' && result.status_code >= 400 && result.status_code < 500) ||
        (statusFilter === 'server-error' && result.status_code >= 500) ||
        (statusFilter === 'connection-error' && result.category === 'Connection Error ❌');

      const matchesCategory = categoryFilter === 'all' || result.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });

    // Sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === 'response_time') {
          aVal = aVal || 0;
          bVal = bVal || 0;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [results, searchTerm, statusFilter, categoryFilter, sortConfig]);

  // Pagination
  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredResults.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredResults, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);

  // Advanced statistics
  const advancedStats = useMemo(() => {
    if (results.length === 0) return {};

    const responseTimes = results.filter(r => r.response_time).map(r => r.response_time);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    const statusCodes = results.reduce((acc, r) => {
      acc[r.status_code] = (acc[r.status_code] || 0) + 1;
      return acc;
    }, {});

    const categoryCounts = results.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1;
      return acc;
    }, {});

    return {
      avgResponseTime,
      fastestSite: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
      slowestSite: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
      statusCodes,
      categoryCounts,
      successRate: ((results.filter(r => r.status >= 200 && r.status < 300).length / results.length) * 100).toFixed(1)
    };
  }, [results]);

  const checkDomainStatus = async (domain) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/check-single`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status_code}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        domain,
        status_code: 'ERROR',
        message: '❌ Connection Failed',
        timestamp: new Date().toLocaleString(),
        response_time: null,
        category: 'Connection Error ❌'
      };
    }
  };

  const checkBulkDomains = async () => {
    if (domains.length === 0) return;

    setLoading(true);
    setResults([]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/check-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domains }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status_code}`);
      }

      const data = await response.json();

      // Transform results to match component structure
      const transformedResults = data.results.map(result => ({
        domain: result.url ? result.url.replace(/^https?:\/\/(www\.)?/, '') : result.domain || 'Unknown',
        status_code: result.status_code || 'Unknown',
        message: result.message || 'No message',
        response_time: result.response_time_sec || null,
        timestamp: data.processed_at || new Date().toLocaleString(),
        category: result.category || 'unknown'
      }));

      setResults(transformedResults);
      setSummary(data.category_counts || { active: 0, error: 0, other: 0 });
    } catch (error) {
      console.error('Error checking domains:', error);
      alert('Failed to check domains. Make sure your Python server is running.');
    }

    setLoading(false);
  };

  const retryFailedDomain = async (domain, index) => {
    setRetryCount(prev => ({ ...prev, [domain]: (prev[domain] || 0) + 1 }));

    const result = await checkDomainStatus(domain);

    setResults(prev => prev.map((r, i) =>
      i === index ? { ...result, timestamp: new Date().toLocaleString() } : r
    ));
  };

  const getStatusColor = (status_code) => {
    if (typeof status === 'number') {
      if (status_code >= 200 && status_code < 300) return 'text-green-600 bg-green-50 border-green-200';
      if (status_code >= 300 && status_code < 400) return 'text-blue-600 bg-blue-50 border-blue-200';
      if (status_code >= 400 && status_code < 500) return 'text-red-600 bg-red-50 border-red-200';
      if (status_code >= 500) return 'text-orange-600 bg-orange-50 border-orange-200';
    }
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'active': return 'text-green-600 bg-green-50 border-green-200';
      case 'Connection Error ❌': return 'text-red-600 bg-red-50 border-red-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'other': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size too large. Please upload a file smaller than 5MB.');
      event.target.value = '';
      return;
    }

    setUploadLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

      const response = await fetch(`${API_BASE_URL}/file_upload`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = 'Failed to upload file';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${response.status_code}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data.results || !Array.isArray(data.results)) {
        throw new Error('Invalid response format from server');
      }

      // Transform the API response to match our component structure
      const transformedResults = data.results.map(result => ({
        domain: result.url ? result.url.replace(/^https?:\/\/(www\.)?/, '') : 'Unknown',
        status_code: result.status_code || 'Unknown',
        message: result.message || 'No message',
        response_time: result.response_time_sec || null,
        timestamp: data.processed_at || new Date().toLocaleString(),
        category: result.category || 'unknown'
      }));

      const extractedDomains = transformedResults.map(r => r.domain);

      setDomains(extractedDomains);
      setResults(transformedResults);
      setSummary(data.category_counts || { active: 0, error: 0, other: 0 });

      alert(`Successfully processed ${data.results.length} URLs. Active: ${data.category_counts?.active || 0}, Error: ${data.category_counts?.error || 0}`);

    } catch (error) {
      console.error('Error uploading file:', error);

      let errorMessage = 'Failed to upload and process file';

      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. The file is too large or contains too many URLs. Try with a smaller file.';
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Cannot connect to server. Please check if the server is running and accessible.';
      } else {
        errorMessage = error.message;
      }

      alert(`Error: ${errorMessage}`);
    }

    setUploadLoading(false);
    event.target.value = '';
  };

  const addManualDomain = () => {
    const domain = document.getElementById('manual-domain').value.trim();
    if (domain && !domains.includes(domain)) {
      setDomains([...domains, domain]);
      document.getElementById('manual-domain').value = '';
    }
  };

  const removeDomain = (index) => {
    const newDomains = domains.filter((_, i) => i !== index);
    setDomains(newDomains);
    if (results.length > 0) {
      setResults(results.filter((_, i) => i !== index));
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleBulkAction = () => {
    if (bulkAction === 'remove-selected') {
      const indicesToRemove = Array.from(selectedDomains);
      setDomains(prev => prev.filter((_, i) => !indicesToRemove.includes(i)));
      setResults(prev => prev.filter((_, i) => !indicesToRemove.includes(i)));
      setSelectedDomains(new Set());
    } else if (bulkAction === 'retry-selected') {
      // Retry selected failed domains
      selectedDomains.forEach(index => {
        if (results[index] && results[index].category === 'Connection Error ❌') {
          retryFailedDomain(results[index].domain, index);
        }
      });
    }
    setBulkAction('');
  };

  const downloadResults = () => {
    if (results.length === 0) return;

    const csvContent = [
      ['Domain', 'Status Code', 'Message', 'Response Time (s)', 'Category', 'Checked At'],
      ...results.map(r => [
        r.domain,
        r.status_code,
        r.message.replace(/[,]/g, ';'),
        r.response_time || 'N/A',
        r.category || 'N/A',
        r.timestamp
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `website-status-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportFiltered = () => {
    if (filteredResults.length === 0) return;

    const csvContent = [
      ['Domain', 'Status Code', 'Message', 'Response Time (s)', 'Category', 'Checked At'],
      ...filteredResults.map(r => [
        r.domain,
        r.status,
        r.message.replace(/[,]/g, ';'),
        r.response_time || 'N/A',
        r.category || 'N/A',
        r.timestamp
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `filtered-website-status-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="w-8 h-8" />
                <div>
                  <h1 className="text-3xl font-bold">Website Status Checker</h1>
                  <p className="text-blue-100 mt-1">Advanced monitoring and analysis tool</p>
                </div>
              </div>
              {results.length > 0 && (
                <div className="text-right">
                  <p className="text-sm text-blue-100">Success Rate</p>
                  <p className="text-2xl font-bold">{advancedStats.successRate}%</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {/* Upload Section */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Add Domains to Check
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                {/* File Upload */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload CSV/Excel File
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileUpload}
                        disabled={uploadLoading}
                        className="hidden"
                        id="file-upload"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        {uploadLoading ? (
                          <RefreshCw className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-spin" />
                        ) : (
                          <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        )}
                        <p className="text-sm text-gray-600">
                          {uploadLoading ? 'Processing file and checking websites... This may take several minutes for large files.' : 'Click to upload CSV or Excel file'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Supported: .csv, .xlsx, .xls (Max 5MB)
                          <br />
                          File will be automatically processed and checked
                        </p>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Manual Entry */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Add Domain Manually
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="manual-domain"
                        placeholder="e.g., google.com"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        onKeyPress={(e) => e.key === 'Enter' && addManualDomain()}
                      />
                      <button
                        onClick={addManualDomain}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Domain List */}
            {domains.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    Domains ({domains.length})
                  </h3>
                  {selectedDomains.size > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={bulkAction}
                        onChange={(e) => setBulkAction(e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="">Bulk Actions</option>
                        <option value="remove-selected">Remove Selected</option>
                        <option value="retry-selected">Retry Selected</option>
                      </select>
                      <button
                        onClick={handleBulkAction}
                        disabled={!bulkAction}
                        className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 disabled:opacity-50"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                  <div className="space-y-2">
                    {domains.map((domain, index) => (
                      <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded-md">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedDomains.has(index)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedDomains);
                              if (e.target.checked) {
                                newSelected.add(index);
                              } else {
                                newSelected.delete(index);
                              }
                              setSelectedDomains(newSelected);
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{domain}</span>
                          {retryCount[domain] && (
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                              Retried {retryCount[domain]}x
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeDomain(index)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {results.length === 0 && (
                  <div className="mt-4">
                    <button
                      onClick={checkBulkDomains}
                      disabled={loading}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                      {loading ? 'Checking...' : 'Check All Domains'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Enhanced Summary */}
            {results.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Analytics Dashboard</h3>
                  <button
                    onClick={() => setShowAdvancedStats(!showAdvancedStats)}
                    className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    {showAdvancedStats ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {showAdvancedStats ? 'Hide' : 'Show'} Advanced Stats
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="w-6 h-6 text-green-500 mr-2" />
                      <div>
                        <p className="text-sm text-green-700 font-medium">Active Sites</p>
                        <p className="text-2xl font-bold text-green-800">{summary.active || 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                    <div className="flex items-center">
                      <XCircle className="w-6 h-6 text-red-500 mr-2" />
                      <div>
                        <p className="text-sm text-red-700 font-medium">Connection Errors</p>
                        <p className="text-2xl font-bold text-red-800">{summary['Connection Error ❌'] || 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                    <div className="flex items-center">
                      <AlertTriangle className="w-6 h-6 text-orange-500 mr-2" />
                      <div>
                        <p className="text-sm text-orange-700 font-medium">Errors</p>
                        <p className="text-2xl font-bold text-orange-800">{summary.error || 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                    <div className="flex items-center">
                      <Info className="w-6 h-6 text-gray-500 mr-2" />
                      <div>
                        <p className="text-sm text-gray-700 font-medium">Others</p>
                        <p className="text-2xl font-bold text-gray-800">{summary.other || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Advanced Statistics */}
                {showAdvancedStats && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-center">
                      <Zap className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                      <p className="text-sm text-blue-700 font-medium">Avg Response Time</p>
                      <p className="text-xl font-bold text-blue-800">
                        {advancedStats.avgResponseTime ? `${advancedStats.avgResponseTime.toFixed(3)}s` : 'N/A'}
                      </p>
                    </div>
                    <div className="text-center">
                      <Clock className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="text-sm text-green-700 font-medium">Fastest Site</p>
                      <p className="text-xl font-bold text-green-800">
                        {advancedStats.fastestSite ? `${advancedStats.fastestSite.toFixed(3)}s` : 'N/A'}
                      </p>
                    </div>
                    <div className="text-center">
                      <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                      <p className="text-sm text-red-700 font-medium">Slowest Site</p>
                      <p className="text-xl font-bold text-red-800">
                        {advancedStats.slowestSite ? `${advancedStats.slowestSite.toFixed(3)}s` : 'N/A'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={downloadResults}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download All Results
                  </button>
                  <button
                    onClick={exportFiltered}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export Filtered ({filteredResults.length})
                  </button>
                </div>
              </div>
            )}


            {/* Search and Filter Controls */}
            {results.length > 0 && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search domains or messages..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                </div>
              </div>
            )}
            {filteredResults.length > 0 ? (
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Results ({filteredResults.length} websites matched)
                </h3>

    

                <div className="overflow-x-auto">
                  <div className="h-[500px] overflow-auto border rounded-lg shadow-sm">
                    <table className="w-full border-collapse bg-white">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="text-left p-4 font-medium text-gray-700 bg-gray-50">Domain</th>
                          <th className="text-left p-4 font-medium text-gray-700 bg-gray-50">Status</th>
                          <th className="text-left p-4 font-medium text-gray-700 bg-gray-50">Message</th>
                          <th className="text-left p-4 font-medium text-gray-700 bg-gray-50">Response Time</th>
                          <th className="text-left p-4 font-medium text-gray-700 bg-gray-50">Category</th>
                          <th className="text-left p-4 font-medium text-gray-700 bg-gray-50">Checked At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredResults.map((result, index) => (
                          <tr key={index} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="p-4 font-medium">{result.domain}</td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status_code)}`}>
                                {result.status_code}
                              </span>
                            </td>
                            <td className="p-4">{result.message}</td>
                            <td className="p-4 text-sm text-gray-600">
                              {result.response_time ? `${result.response_time.toFixed(3)}s` : 'N/A'}
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${result.category === 'active' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                                }`}>
                                {result.category || 'N/A'}
                              </span>
                            </td>
                            <td className="p-4 text-sm text-gray-600">{result.timestamp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 mt-4">No results found for your search.</p>
            )}



          </div>
        </div>
      </div>
    </div>
  )
}
export default WebsiteStatusChecker