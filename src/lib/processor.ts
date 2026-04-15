import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ProcessResult {
  success: boolean;
  message?: string;
  csvData?: string;
  errors?: string[];
}

export async function processFiles(
  vendasFile: File,
  precosFile: File,
  produtosFile: File
): Promise<ProcessResult> {
  try {
    const vendasCols = ['CÓD', 'LOJA', 'Data', 'Código5', 'Item', 'Quant.', 'Marca'];
    const precosCols = ['N&L', 'PREÇO CIRCANA'];
    const produtosCols = ['Codigo', 'Ref. Fornecedor', 'Barras'];

    const [vendasData, precosData, produtosData] = await Promise.all([
      readExcel(vendasFile, vendasCols),
      readExcel(precosFile, precosCols),
      readExcel(produtosFile, produtosCols),
    ]);

    const vendasErrors = validateColumns(vendasData, vendasCols, 'Vendas');
    const precosErrors = validateColumns(precosData, precosCols, 'Preços');
    const produtosErrors = validateColumns(produtosData, produtosCols, 'Cadastro de Produtos');

    const allErrors = [...vendasErrors, ...precosErrors, ...produtosErrors];
    if (allErrors.length > 0) {
      return { success: false, errors: allErrors };
    }

    // Create lookup maps
    const precosMap = new Map<string, any>();
    for (const row of precosData) {
      if (row['N&L']) {
        precosMap.set(String(row['N&L']).trim(), row);
      }
    }

    const produtosMap = new Map<string, any>();
    for (const row of produtosData) {
      if (row['Codigo']) {
        produtosMap.set(String(row['Codigo']).trim(), row);
      }
    }

    const resultData: any[] = [];

    for (const venda of vendasData) {
      const codigo5 = String(venda['Código5'] || '').trim();
      if (!codigo5) continue;

      const preco = precosMap.get(codigo5);
      const produto = produtosMap.get(codigo5);

      if (!preco || !produto) {
        // Ignorar registros sem correspondência
        continue;
      }

      const quant = Number(venda['Quant.']) || 0;
      const unidades = quant >= 0 ? quant : 0;
      const pecasDevolucao = quant < 0 ? Math.abs(quant) : 0;
      const precoLista = Number(preco['PREÇO CIRCANA']) || 0;

      let ano = '', mes = '', dia = '';
      if (venda['Data']) {
        const parsedDate = parseExcelDate(venda['Data']);
        if (parsedDate) {
          ano = String(parsedDate.getFullYear());
          mes = String(parsedDate.getMonth() + 1).padStart(2, '0');
          dia = String(parsedDate.getDate()).padStart(2, '0');
        }
      }

      resultData.push({
        'Código Fornecedor': '1',
        'Fornecedor (Local)': 'TABATINGA FREE SHOP COM.EXP.IMP.LTDA',
        'Código Sucursal': venda['CÓD'] || '',
        'Sucursal': venda['LOJA'] || '',
        'Código Prod do Fornecedor': produto['Ref. Fornecedor'] || '',
        'Código de Barras': produto['Barras'] || '',
        'Cód Prod Top Internacional': codigo5,
        'Marca': venda['Marca'] || '',
        'Descrição do Produto': venda['Item'] || '',
        'Ano': ano,
        'Mês': mes,
        'Dia': dia,
        'Unidades': unidades,
        'Preço Lista': precoLista,
        'Valor de Venda': unidades * precoLista,
        'Peças de Devoluções': pecasDevolucao,
        'Valor de Devoluções': pecasDevolucao * precoLista,
        'Tipo PDV': 'Loja',
      });
    }

    if (resultData.length === 0) {
      return { success: false, message: 'Nenhum registro válido encontrado após o cruzamento dos dados.' };
    }

    const csvData = Papa.unparse(resultData, {
      delimiter: ';',
      header: true,
    });

    return { success: true, csvData };
  } catch (error: any) {
    return { success: false, message: 'Erro ao processar arquivos: ' + error.message };
  }
}

function readExcel(file: File, requiredCols: string[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let bestSheetData: any[] = [];
        let bestMatchCount = -1;

        // Iterate through all sheets
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert to array of arrays to find the header row
          const aoa: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          if (aoa.length === 0) continue;

          let headerRowIndex = 0;
          let maxColsFound = 0;

          // Check the first 30 rows to find the one with the most required columns
          for (let i = 0; i < Math.min(aoa.length, 30); i++) {
            const row = aoa[i];
            if (!Array.isArray(row)) continue;
            
            const rowStrings = row.map(cell => String(cell).trim());
            const colsFound = requiredCols.filter(col => rowStrings.includes(col)).length;
            
            if (colsFound > maxColsFound) {
              maxColsFound = colsFound;
              headerRowIndex = i;
            }
          }

          // Parse the sheet starting from the identified header row
          const json = XLSX.utils.sheet_to_json(worksheet, { 
            range: headerRowIndex,
            defval: '' 
          });

          if (json.length > 0) {
            const firstRow = json[0];
            const colsFound = requiredCols.filter(col => col in firstRow).length;
            
            if (colsFound > bestMatchCount) {
              bestMatchCount = colsFound;
              bestSheetData = json;
            }
          } else if (bestMatchCount === -1) {
            bestSheetData = [];
          }
        }

        resolve(bestSheetData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

function validateColumns(data: any[], requiredCols: string[], fileName: string): string[] {
  if (data.length === 0) {
    return [`O arquivo ${fileName} parece estar vazio ou os dados não foram encontrados nas primeiras linhas/abas.`];
  }
  const firstRow = data[0];
  const missingCols = requiredCols.filter(col => !(col in firstRow));
  if (missingCols.length > 0) {
    return [`O arquivo ${fileName} não possui as colunas obrigatórias: ${missingCols.join(', ')}`];
  }
  return [];
}

function parseExcelDate(excelDate: any): Date | null {
  if (!excelDate) return null;
  
  // If it's already a Date object
  if (excelDate instanceof Date) return excelDate;
  
  // If it's a number (Excel serial date)
  if (typeof excelDate === 'number') {
    // Excel dates are days since 1900-01-01. 
    // 25569 is the number of days between 1900-01-01 and 1970-01-01
    const date = new Date((excelDate - (25569 + 1)) * 86400 * 1000);
    // Add timezone offset to avoid day shifting
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return date;
  }
  
  // If it's a string
  if (typeof excelDate === 'string') {
    // Try parsing DD/MM/YYYY
    const parts = excelDate.split(/[-/]/);
    if (parts.length === 3) {
      // Assume DD/MM/YYYY or YYYY-MM-DD
      if (parts[0].length === 4) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else {
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }
    const parsed = new Date(excelDate);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  
  return null;
}
