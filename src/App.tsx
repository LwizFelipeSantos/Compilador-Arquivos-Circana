/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, AlertCircle, CheckCircle2, Loader2, Database, Filter } from 'lucide-react';
import Papa from 'papaparse';
import { processFiles } from './lib/processor';

export default function App() {
  const [vendasFile, setVendasFile] = useState<File | null>(null);
  const [precosFile, setPrecosFile] = useState<File | null>(null);
  const [produtosFile, setProdutosFile] = useState<File | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string | null>(null);
  const [resultData, setResultData] = useState<any[] | null>(null);
  const [availableLojas, setAvailableLojas] = useState<string[]>([]);
  const [selectedLojas, setSelectedLojas] = useState<string[]>([]);

  const handleProcess = async () => {
    if (!vendasFile || !precosFile || !produtosFile) {
      setError('Por favor, faça o upload dos 3 arquivos para continuar.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setErrors([]);
    setCsvData(null);
    setResultData(null);
    setAvailableLojas([]);
    setSelectedLojas([]);

    try {
      const result = await processFiles(vendasFile, precosFile, produtosFile);
      
      if (result.success && result.resultData) {
        setCsvData(result.csvData || null);
        setResultData(result.resultData);
        
        // Extract unique stores
        const lojas = Array.from(new Set(result.resultData.map(r => r['Sucursal'])))
          .filter(Boolean)
          .sort() as string[];
          
        setAvailableLojas(lojas);
        setSelectedLojas(lojas); // Select all by default
      } else {
        if (result.errors && result.errors.length > 0) {
          setErrors(result.errors);
        } else {
          setError(result.message || 'Ocorreu um erro desconhecido.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar os arquivos.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultData) return;
    
    const filteredData = resultData.filter(row => selectedLojas.includes(row['Sucursal']));
    
    if (filteredData.length === 0) {
      setError('Nenhum dado para exportar com os filtros selecionados.');
      return;
    }

    const csv = Papa.unparse(filteredData, {
      delimiter: ';',
      header: true,
    });
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'relatorio_consolidado.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClear = () => {
    setVendasFile(null);
    setPrecosFile(null);
    setProdutosFile(null);
    setCsvData(null);
    setResultData(null);
    setAvailableLojas([]);
    setSelectedLojas([]);
    setError(null);
    setErrors([]);
  };

  return (
    <div 
      className="min-h-screen flex flex-col bg-[#F0F2F5] text-[#3C4043]"
      style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
    >
      {/* Header */}
      <header className="h-[80px] bg-white border-b border-[#DADCE0] flex items-center px-6 md:px-10 justify-between shrink-0">
        <div className="text-[22px] font-bold text-[#1A73E8] flex items-center gap-3">
          <div className="w-8 h-8 bg-[#1A73E8] rounded-md flex items-center justify-center">
            <Database className="text-white w-5 h-5" />
          </div>
          Tabatinga Data Link
        </div>
        <div className="text-[13px] text-[#5F6368] hidden md:block">
          v2.4.0 &bull; {isProcessing ? 'Processando...' : csvData ? 'Concluído' : 'Pronto para Processar'}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6 content-start overflow-auto">
        <div className="col-span-full mb-2 text-[14px] uppercase tracking-[1px] text-[#5F6368] font-semibold">
          Arquivos de Entrada (.xlsx)
        </div>
        
        <FileUploadCard 
          title="Vendas" 
          hint="Campo: Código5"
          icon="📊"
          file={vendasFile} 
          setFile={setVendasFile} 
        />
        <FileUploadCard 
          title="Preços" 
          hint="Campo: N&L"
          icon="🏷️"
          file={precosFile} 
          setFile={setPrecosFile} 
        />
        <FileUploadCard 
          title="Produtos" 
          hint="Campo: Codigo"
          icon="📦"
          file={produtosFile} 
          setFile={setProdutosFile} 
        />

        {/* Mapping Visual */}
        {!resultData && (
          <div className="col-span-full bg-white border border-[#DADCE0] rounded-xl p-6 mt-6 hidden md:flex items-center justify-around relative">
            <div className="absolute h-[2px] bg-[#DADCE0] w-[70%] top-[60px] z-10"></div>
            <div className="text-center z-20 bg-white px-4">
              <div className="text-[11px] text-[#5F6368] mb-2">VENDAS</div>
              <div className="font-mono bg-[#F8F9FA] px-3 py-1.5 rounded border border-[#DADCE0] font-semibold text-[#1A73E8]">Código5</div>
            </div>
            <div className="text-center z-20 bg-white px-4">
              <div className="text-[11px] text-[#5F6368] mb-2">PREÇOS</div>
              <div className="font-mono bg-[#F8F9FA] px-3 py-1.5 rounded border border-[#DADCE0] font-semibold text-[#1A73E8]">N&amp;L</div>
            </div>
            <div className="text-center z-20 bg-white px-4">
              <div className="text-[11px] text-[#5F6368] mb-2">CADASTRO</div>
              <div className="font-mono bg-[#F8F9FA] px-3 py-1.5 rounded border border-[#DADCE0] font-semibold text-[#1A73E8]">Codigo</div>
            </div>
          </div>
        )}

        {/* Filter UI */}
        {resultData && availableLojas.length > 0 && (
          <div className="col-span-full bg-white border border-[#DADCE0] rounded-xl p-6 mt-6">
            <h3 className="text-[14px] uppercase tracking-[1px] text-[#5F6368] font-semibold mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtrar por Loja (Sucursal)
            </h3>
            <div className="max-h-48 overflow-y-auto flex flex-wrap gap-3 p-1">
              {availableLojas.map(loja => (
                <label key={loja} className="flex items-center gap-2 text-[14px] bg-[#F8F9FA] border border-[#DADCE0] px-3 py-2 rounded-md cursor-pointer hover:bg-[#E8F0FE] hover:border-[#1A73E8] transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selectedLojas.includes(loja)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedLojas([...selectedLojas, loja]);
                      } else {
                        setSelectedLojas(selectedLojas.filter(l => l !== loja));
                      }
                    }}
                    className="rounded border-gray-300 text-[#1A73E8] focus:ring-[#1A73E8]"
                  />
                  {loja}
                </label>
              ))}
            </div>
            <div className="mt-4 flex gap-4 text-[13px]">
              <button 
                onClick={() => setSelectedLojas(availableLojas)}
                className="text-[#1A73E8] hover:underline font-medium"
              >
                Selecionar Todas
              </button>
              <button 
                onClick={() => setSelectedLojas([])}
                className="text-[#5F6368] hover:underline font-medium"
              >
                Limpar Seleção
              </button>
            </div>
          </div>
        )}

        {/* Errors */}
        {(error || errors.length > 0) && (
          <div className="col-span-full mt-2 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Erro no processamento</h3>
              {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
              {errors.length > 0 && (
                <ul className="mt-2 list-disc list-inside text-sm text-red-700 space-y-1">
                  {errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Status Bar / Actions */}
      <div className="md:h-[120px] bg-white border-t border-[#DADCE0] flex flex-col md:flex-row items-center px-6 md:px-10 py-6 md:py-0 gap-6 md:gap-8 shrink-0">
        <div className="flex-1 w-full">
          <div className="flex justify-between mb-2 text-[13px] font-medium">
            <span>Status do Processamento</span>
            <span>{isProcessing ? 'Processando...' : csvData ? 'Concluído (100%)' : 'Aguardando arquivos...'}</span>
          </div>
          <div className="h-2 bg-[#E8EAED] rounded-full overflow-hidden">
            <div className={`h-full bg-[#1E8E3E] transition-all duration-500 ${csvData ? 'w-full' : isProcessing ? 'w-1/2 animate-pulse' : 'w-0'}`}></div>
          </div>
          <div className="text-[12px] text-[#5F6368] flex flex-wrap gap-4 md:gap-5 mt-3">
            <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-[#1E8E3E] rounded-full"></span> Saída: CSV</div>
            <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-[#1E8E3E] rounded-full"></span> Separador: Ponto e vírgula (;)</div>
            <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-[#1E8E3E] rounded-full"></span> Codificação: UTF-8</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 w-full md:w-auto justify-end">
          <button 
            onClick={handleClear}
            className="px-6 py-3 rounded-md font-semibold text-[14px] transition-opacity bg-transparent border border-[#DADCE0] text-[#5F6368] hover:bg-gray-50 w-full md:w-auto"
          >
            Limpar Arquivos
          </button>
          
          {!csvData ? (
            <button 
              onClick={handleProcess}
              disabled={isProcessing || !vendasFile || !precosFile || !produtosFile}
              className="px-6 py-3 rounded-md font-semibold text-[14px] transition-opacity bg-[#1A73E8] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 flex items-center justify-center gap-2 w-full md:w-auto"
            >
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
              Processar Cruzamento
            </button>
          ) : (
            <button 
              onClick={handleDownload}
              className="px-6 py-3 rounded-md font-semibold text-[14px] transition-opacity bg-[#1E8E3E] text-white hover:bg-green-700 flex items-center justify-center gap-2 w-full md:w-auto"
            >
              <Download className="w-4 h-4" />
              Baixar Relatório Final
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface FileUploadCardProps {
  title: string;
  hint: string;
  icon: string;
  file: File | null;
  setFile: (file: File | null) => void;
}

function FileUploadCard({ title, hint, icon, file, setFile }: FileUploadCardProps) {
  const isActive = !!file;
  
  return (
    <label 
      className={`bg-white border-2 border-dashed rounded-xl p-6 md:p-8 text-center h-[240px] flex flex-col justify-center items-center transition-colors cursor-pointer ${
        isActive ? 'border-[#1A73E8] bg-[#E8F0FE]' : 'border-[#DADCE0] hover:border-[#1A73E8]'
      }`}
    >
      <input
        type="file"
        className="hidden"
        accept=".xlsx, .xls"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) setFile(selected);
        }}
      />
      
      <div className="text-[32px] mb-4 flex items-center justify-center">
        {isActive ? <CheckCircle2 className="w-10 h-10 text-[#1E8E3E]" /> : <span>{icon}</span>}
      </div>
      
      <div className="font-semibold text-[15px] mb-1 text-[#3C4043] flex items-center justify-center gap-2 max-w-full">
        <span className="truncate">{file ? file.name : `Selecionar ${title}`}</span>
        {isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#CEEAD6] text-[#0D652D] shrink-0">OK</span>}
      </div>
      
      <div className="text-[12px] text-[#5F6368]">{hint}</div>
      
      {isActive && (
        <div className="text-[11px] mt-3 text-[#1E8E3E]">
          Arquivo carregado com sucesso
        </div>
      )}
    </label>
  );
}
