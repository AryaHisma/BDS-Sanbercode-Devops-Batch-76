import React, { useState, useRef, useEffect } from 'react';
import { Upload, Search, FileText, Trash2, Download, Eye, Sparkles, Loader2 } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('search');
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Polling: Auto-refresh list setiap 2 detik JIKA ada file yang masih diproses
  useEffect(() => {
    const isProcessing = documents.some(doc => doc.summary === 'Memproses AI Summary...');
    if (isProcessing) {
      const interval = setInterval(() => {
        fetchDocuments();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [documents]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      if (!res.ok) {
         setDocuments([]);
         return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setDocuments(data);
      } else {
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      setDocuments([]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg shadow-md">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              DocuSearch AI
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex space-x-2">
              <button 
                onClick={() => setActiveTab('search')}
                className={`px-4 py-2 rounded-md font-medium transition-all ${activeTab === 'search' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
              >
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Cari Dokumen
                </div>
              </button>
              <button 
                onClick={() => setActiveTab('upload')}
                className={`px-4 py-2 rounded-md font-medium transition-all ${activeTab === 'upload' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
              >
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload PDF
                </div>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-xl shadow-blue-900/5 border border-gray-100 overflow-hidden min-h-[500px]">
          {activeTab === 'search' ? <SearchTab /> : <UploadTab documents={documents} fetchDocuments={fetchDocuments} />}
        </div>
      </main>
    </div>
  );
}

function SearchTab() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, model: 'groq' }),
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Error searching:', error);
      alert('Gagal melakukan pencarian. Pastikan server backend berjalan.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto text-center mb-10">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Cari Dokumen Anda</h2>
        <p className="text-gray-500">Temukan dokumen dengan mencari kata spesifik di dalamnya. AI akan otomatis merangkum bagian yang Anda temukan.</p>
      </div>
      
      <div className="max-w-3xl mx-auto">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-6 w-6 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="block w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
            placeholder="Ketik kata spesifik yang ingin Anda temukan di dalam dokumen..."
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
            <button 
              onClick={handleSearch}
              disabled={isSearching}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg cursor-pointer flex items-center gap-2"
            >
              {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {isSearching ? 'Mencari...' : 'Cari'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="mt-10 space-y-6">
          {hasSearched && !isSearching && results.length === 0 && (
             <div className="text-center text-gray-500 py-10 bg-gray-50 rounded-xl border border-gray-100">
               Tidak ada hasil yang ditemukan untuk "{query}".
             </div>
          )}
          
          {results.map((result, idx) => (
            <div key={idx} className="p-6 border border-gray-100 rounded-xl hover:shadow-md transition-shadow bg-white">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  {result.name}
                </h3>
                <div className="flex gap-2">
                  <a href={`/api/documents/${result.id}/download`} className="p-2 text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="Download">
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                ...{result.snippet}...
              </p>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5 shadow-inner">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-blue-800 tracking-wider uppercase">AI Summary (Groq)</span>
                  </div>
                </div>
                <p className="text-sm text-gray-700 italic border-l-2 border-blue-300 pl-3 whitespace-pre-wrap">
                  "{result.aiSummary}"
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UploadTab({ documents, fetchDocuments }) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validasi ukuran file (Maksimal 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Gagal mengunggah: Ukuran file melebihi batas maksimal 5 MB.');
        event.target.value = '';
        return;
      }

      const formData = new FormData();
      formData.append('document', file);
      
      setIsUploading(true);
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (res.ok) {
           await fetchDocuments();
        } else {
           const err = await res.json();
           alert('Gagal mengupload: ' + err.error);
        }
      } catch (error) {
        console.error("Upload error:", error);
        alert('Terjadi kesalahan saat mengupload dokumen.');
      } finally {
        setIsUploading(false);
      }
    }
    // Reset agar bisa upload file yang sama jika sudah dihapus
    event.target.value = '';
  };

  const handleDelete = async (id) => {
    if (confirm('Apakah Anda yakin ingin menghapus dokumen ini?')) {
      try {
        const res = await fetch(`/api/documents/${id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          await fetchDocuments();
        }
      } catch (error) {
        console.error("Delete error:", error);
        alert('Gagal menghapus dokumen.');
      }
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto text-center mb-10">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Upload Dokumen Baru</h2>
        <p className="text-gray-500">Unggah file PDF Anda. Sistem AI kami akan memproses dan membuat ringkasan secara otomatis saat Anda mencari.</p>
      </div>

      <div className="max-w-3xl mx-auto space-y-8">
        {/* Upload Area */}
        <div 
          onClick={!isUploading ? handleUploadClick : undefined}
          className={`border-2 border-dashed ${isUploading ? 'border-gray-300 bg-gray-50' : 'border-blue-200 bg-blue-50/50 hover:bg-blue-50 cursor-pointer'} rounded-2xl p-12 text-center transition-colors group`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".pdf" 
            className="hidden" 
            disabled={isUploading}
          />
          <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
            {isUploading ? <Loader2 className="w-8 h-8 text-blue-500 animate-spin" /> : <Upload className="w-8 h-8 text-blue-500" />}
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {isUploading ? 'Mengunggah dan Memproses...' : 'Klik untuk upload PDF'}
          </h3>
          <p className="text-sm text-gray-500">Hanya file PDF (Maks. 5MB)</p>
        </div>

        {/* Uploaded Files List */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Dokumen Anda
          </h3>
          <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50 shadow-sm">
            {documents.length === 0 ? (
              <div className="p-6 text-center text-gray-500">Belum ada dokumen yang diunggah.</div>
            ) : (
              documents.map(doc => (
                <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                      <FileText className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800">{doc.name}</h4>
                      <p className="text-xs text-gray-400 mt-1">{doc.size} • {doc.date}</p>
                      {doc.summary && (
                        <div className="mt-2 text-sm text-gray-600 bg-blue-50/50 p-2 rounded-md border border-blue-100 flex gap-2 items-start">
                          <Sparkles className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                          <p className="italic">"{doc.summary}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                     <a 
                      href={`/api/documents/${doc.id}/download`}
                      className="p-2 text-gray-400 hover:text-blue-600 bg-white border border-gray-100 hover:border-blue-100 shadow-sm rounded-lg transition-all cursor-pointer inline-block" 
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button 
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 text-gray-400 hover:text-red-500 bg-white border border-gray-100 hover:border-red-100 shadow-sm rounded-lg transition-all cursor-pointer" 
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
