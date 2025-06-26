import React, { useState } from 'react';
import { Upload, Download, Globe, CheckCircle, XCircle, AlertTriangle, RefreshCw, FileText } from 'lucide-react';

const WebsiteStatusChecker = () => {
  const [domains, setDomains] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [summary, setSummary] = useState({ active: 0, inactive: 0, errors: 0, redirects: 0 });

  // You can change this URL based on your server setup
  const API_BASE_URL = 'http://65.2.57.231:5000';

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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        domain,
        status: 'ERROR',
        message: '❌ Connection Failed',
        timestamp: new Date().toLocaleString(),
        response_time: null
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResults(data.results);
      setSummary(data.summary);
    } catch (error) {
      console.error('Error checking domains:', error);
      alert('Failed to check domains. Make sure your Python server is running.');
    }

    setLoading(false);
  };

  const getStatusColor = (status) => {
    if (typeof status === 'number') {
      if (status >= 200 && status < 300) return 'text-green-600 bg-green-50';
      if (status >= 300 && status < 400) return 'text-blue-600 bg-blue-50';
      if (status >= 400 && status < 500) return 'text-red-600 bg-red-50';
      if (status >= 500) return 'text-orange-600 bg-orange-50';
    }
    return 'text-gray-600 bg-gray-50';
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
        mode: 'cors', // Explicitly set CORS mode
        credentials: 'omit', // Don't send credentials
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = 'Failed to upload file';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (!data.results || !Array.isArray(data.results)) {
        throw new Error('Invalid response format from server');
      }

      // Transform the API response to match our component structure
      const transformedResults = data.results.map(result => ({
        domain: result.url ? result.url.replace(/^https?:\/\/(www\.)?/, '') : 'Unknown', // Clean domain name
        status: result.status_code || 'Unknown',
        message: result.message || 'No message',
        response_time: result.response_time_sec || null,
        timestamp: data.processed_at || new Date().toLocaleString(),
        category: result.category || 'unknown'
      }));

      const extractedDomains = transformedResults.map(r => r.domain);
      
      // Update summary based on the new API response format
      const newSummary = {
        active: data.category_counts?.active || 0,
        inactive: 0, // Not provided in new API
        errors: data.category_counts?.error || 0,
        redirects: 0 // Not provided in new API
      };

      setDomains(extractedDomains);
      setResults(transformedResults);
      setSummary(newSummary);

      alert(`Successfully processed ${data.results.length} URLs. Active: ${newSummary.active}, Errors: ${newSummary.errors}`);
      
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

  const downloadResults = () => {
    if (results.length === 0) return;

    const csvContent = [
      ['Domain', 'Status Code', 'Message', 'Response Time (s)', 'Category', 'Checked At'],
      ...results.map(r => [
        r.domain, 
        r.status, 
        r.message.replace(/[,]/g, ';'), // Replace commas to avoid CSV issues
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <div className="flex items-center gap-3">
              <Globe className="w-8 h-8" />
              <div>
                <h1 className="text-3xl font-bold">Website Status Checker</h1>
                <p className="text-blue-100 mt-1">Check multiple websites and domains for availability</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Server Connection Test */}
            {/* <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="text-sm font-medium text-yellow-800 mb-2">🔧 Server Connection & CORS Test</h3>
              <p className="text-xs text-yellow-700 mb-2">Current API: {API_BASE_URL}</p>
              <div className="space-x-2">
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(`${API_BASE_URL}/`, { 
                        method: 'GET',
                        mode: 'cors'
                      });
                      alert(`Server Status: ${response.ok ? '✅ Connected' : '❌ Error ' + response.status}`);
                    } catch (error) {
                      if (error.message.includes('CORS')) {
                        alert(`❌ CORS Error: The server needs to allow browser requests. Error: ${error.message}`);
                      } else {
                        alert(`❌ Cannot connect to server: ${error.message}`);
                      }
                    }
                  }}
                  className="px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
                >
                  Test Connection
                </button>
                <button
                  onClick={() => {
                    const newUrl = prompt('Enter new API URL:', API_BASE_URL);
                    if (newUrl) {
                      // This is a demo - in real app you'd update state
                      alert('In a real app, this would update the API URL. Current demo uses fixed URL.');
                    }
                  }}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                >
                  Change API URL
                </button>
              </div>
              <div className="mt-2 text-xs text-yellow-700">
                <strong>CORS Issue?</strong> Your server needs to allow browser requests. See solutions below.
              </div>
            </div> */}

            {/* CORS Solutions */}
            {/* <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-medium text-blue-800 mb-2">🛠️ CORS Solutions</h3>
              <div className="text-xs text-blue-700 space-y-2">
                <div><strong>Python Flask:</strong> Add <code className="bg-blue-100 px-1 rounded">pip install flask-cors</code> and <code className="bg-blue-100 px-1 rounded">CORS(app)</code></div>
                <div><strong>Alternative:</strong> Use a browser extension like "CORS Unblock" for testing</div>
                <div><strong>Production:</strong> Deploy both frontend and backend on same domain</div>
              </div>
            </div> */}

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
                          <br />
                          Large files may take 5+ minutes to process
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
                <h3 className="text-lg font-semibold mb-4">
                  Domains ({domains.length})
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                  <div className="space-y-2">
                    {domains.map((domain, index) => (
                      <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded-md">
                        <span className="text-sm">{domain}</span>
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
                
                {/* Only show manual check button if we have manually added domains */}
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

            {/* Summary */}
            {results.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                    <div className="flex items-center">
                      <CheckCircle className="w-6 h-6 text-green-500 mr-2" />
                      <div>
                        <p className="text-sm text-green-700 font-medium">Active Sites</p>
                        <p className="text-2xl font-bold text-green-800">{summary.active}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                    <div className="flex items-center">
                      <XCircle className="w-6 h-6 text-red-500 mr-2" />
                      <div>
                        <p className="text-sm text-red-700 font-medium">Errors</p>
                        <p className="text-2xl font-bold text-red-800">{summary.errors}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <button
                    onClick={downloadResults}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-5 h-5" />
                    Download Report
                  </button>
                </div>
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Results ({results.length} websites checked)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-4 font-medium text-gray-700">Domain</th>
                        <th className="text-left p-4 font-medium text-gray-700">Status</th>
                        <th className="text-left p-4 font-medium text-gray-700">Message</th>
                        <th className="text-left p-4 font-medium text-gray-700">Response Time</th>
                        <th className="text-left p-4 font-medium text-gray-700">Category</th>
                        <th className="text-left p-4 font-medium text-gray-700">Checked At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result, index) => (
                        <tr key={index} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="p-4 font-medium">{result.domain}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
                              {result.status}
                            </span>
                          </td>
                          <td className="p-4">{result.message}</td>
                          <td className="p-4 text-sm text-gray-600">
                            {result.response_time ? `${result.response_time.toFixed(3)}s` : 'N/A'}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              result.category === 'active' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
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
            )}

            {domains.length === 0 && (
              <div className="text-center py-12">
                <Globe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No domains added yet</h3>
                <p className="text-gray-500">Upload a CSV/Excel file to automatically check websites, or add domains manually</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebsiteStatusChecker;