/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { WeeklyClosing, Transaction, Category, Box } from '../types';

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

const formatDateTime = (isoStr: string) => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('pt-BR');
  } catch {
    return isoStr;
  }
};

/**
 * Generates and downloads an official Weekly Closing Financial Report PDF (Ata Semanal)
 * for physical printing, filing, and auditing.
 */
export async function exportWeeklyClosingToPDF(
  closing: WeeklyClosing,
  transactions: Transaction[]
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);

  // Helper for drawing horizontal divider lines
  const drawDivider = (y: number, color: [number, number, number] = [200, 200, 200], lineWidth = 0.3) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(lineWidth);
    doc.line(margin, y, pageWidth - margin, y);
  };

  let currentY = margin;

  // 1. Header Banner & Letterhead
  doc.setFillColor(30, 41, 59); // Slate 850
  doc.rect(margin, currentY, contentWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ESCOLA BÍBLICA DOMINICAL (EBD) • IEADALPE', margin + 4, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text('Congregação Jardim Paulista Baixo • Departamento de Finanças e Tesouraria', margin + 4, currentY + 12.5);
  doc.text('Documento Oficial de Apuração Financeira e Prestação de Contas Semanal', margin + 4, currentY + 17.5);

  // Badge on the top right
  doc.setFillColor(79, 70, 229); // Indigo 600
  doc.roundedRect(pageWidth - margin - 38, currentY + 4.5, 34, 15, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('FOLHA OFICIAL', pageWidth - margin - 35, currentY + 9.5);
  doc.setFontSize(7);
  doc.text('EBD-FINANÇAS', pageWidth - margin - 35, currentY + 14.5);

  currentY += 28;

  // 2. Document Title Box
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`ATA DE FECHAMENTO SEMANAL • ${closing.closingNum}`, margin, currentY);

  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text(
    `Período de Apuração: de ${formatDate(closing.startDate)} até ${formatDate(closing.endDate)} | Data de Emissão: ${formatDateTime(closing.closedAt)}`,
    margin,
    currentY
  );

  currentY += 4;
  drawDivider(currentY, [226, 232, 240]);
  currentY += 5;

  // 3. Financial Summary KPIs (4 Cards in a grid)
  const cardWidth = (contentWidth - 9) / 4;
  const cardHeight = 16;
  const cards = [
    { label: 'Saldo Anterior', value: formatCurrency(closing.startingBalance), color: [71, 85, 105], bg: [248, 250, 252] },
    { label: '(+) Entradas', value: `+${formatCurrency(closing.totalInflows)}`, color: [16, 185, 129], bg: [236, 253, 245] },
    { label: '(-) Saídas', value: `-${formatCurrency(closing.totalOutflows)}`, color: [239, 68, 68], bg: [254, 242, 242] },
    { label: '(=) Saldo Final', value: formatCurrency(closing.endingBalance), color: [67, 56, 202], bg: [238, 242, 255] }
  ];

  cards.forEach((c, idx) => {
    const cardX = margin + idx * (cardWidth + 3);
    doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(c.label.toUpperCase(), cardX + 3, currentY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(c.value, cardX + 3, currentY + 11.5);
  });

  currentY += cardHeight + 6;

  // 4. Narrative / Legal Statement
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  const narrativeText = `Aos ${formatDate(closing.closedAt).split('/')[0]} dias de ${new Date(closing.closedAt).toLocaleString('pt-BR', { month: 'long' })} de ${new Date(closing.closedAt).getFullYear()}, sob a orientação administrativa da diretoria da EBD, procedeu-se a apuração e fechamento das contas da Escola Bíblica Dominical, totalizando o fluxo financeiro de R$ ${formatCurrency(closing.totalInflows)} em receitas e R$ ${formatCurrency(closing.totalOutflows)} em despesas computadas.`;
  const splitNarrative = doc.splitTextToSize(narrativeText, contentWidth - 6);
  doc.text(splitNarrative, margin + 3, currentY + 5);

  currentY += 18;

  // 5. Filter Transactions in this closing range
  const isDateBetween = (dateStr: string, startStr: string, endStr: string) => {
    return dateStr >= startStr && dateStr <= endStr;
  };
  const cycleTransactions = transactions.filter(
    t => isDateBetween(t.date, closing.startDate, closing.endDate) && t.isApproved !== false
  );

  // 6. Itemized Transactions Table using autoTable
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`TRANSAÇÕES CONCILIADAS NO PERÍODO (${cycleTransactions.length})`, margin, currentY);
  currentY += 3;

  const tableData = cycleTransactions.map(t => [
    t.transactionNum,
    formatDate(t.date),
    t.type === 'ENTRADA' ? 'Entrada' : 'Saída',
    t.boxId === 'CAIXA_5_EBD' ? '5% EBD' : 'Lições',
    t.responsible,
    t.description || 'Lançamento regular de caixa',
    `${t.type === 'ENTRADA' ? '+' : '-'} ${formatCurrency(t.amount)}`
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Voucher', 'Data', 'Tipo', 'Caixa', 'Responsável', 'Detalhamento', 'Valor']],
    body: tableData.length > 0 ? tableData : [['-', '-', '-', '-', '-', 'Nenhuma movimentação registrada no ciclo', '-']],
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [71, 85, 105],
      fontStyle: 'bold',
      fontSize: 7.5
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250]
    },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold' },
      1: { cellWidth: 18 },
      2: { cellWidth: 16 },
      3: { cellWidth: 18 },
      4: { cellWidth: 26 },
      5: { cellWidth: 'auto' },
      6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 6) {
        const text = data.cell.raw as string;
        if (text.startsWith('+')) {
          data.cell.styles.textColor = [16, 185, 129];
        } else if (text.startsWith('-')) {
          data.cell.styles.textColor = [239, 68, 68];
        }
      }
    }
  });

  // Get final Y position after the table
  const finalY = (doc as any).lastAutoTable?.finalY || (currentY + 40);
  currentY = finalY + 6;

  // If table went too close to bottom, add a new page
  if (currentY > pageHeight - 55) {
    doc.addPage();
    currentY = margin + 5;
  }

  // 7. Comments / Observations if any
  if (closing.comments) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('OBSERVAÇÕES E PARECER DA TESOURARIA:', margin, currentY);
    currentY += 3.5;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    const commentLines = doc.splitTextToSize(closing.comments, contentWidth - 6);
    const commentBoxHeight = Math.max(10, (commentLines.length * 3.5) + 5);
    doc.roundedRect(margin, currentY, contentWidth, commentBoxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(commentLines, margin + 3, currentY + 4);

    currentY += commentBoxHeight + 6;
  }

  // Check page height again for Signatures block
  if (currentY > pageHeight - 48) {
    doc.addPage();
    currentY = margin + 5;
  }

  // 8. Approval and Signatures Block
  const sigBoxWidth = (contentWidth - 10) / 2;
  const sigBoxHeight = 32;

  // Box 1: Treasurer Signature
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, currentY, sigBoxWidth, sigBoxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('RELATOR / TESOUREIRO RESPONSÁVEL', margin + 4, currentY + 4.5);

  // If digital signature exists, render image inside
  if (closing.treasurerSignature && closing.treasurerSignature.startsWith('data:image')) {
    try {
      doc.addImage(
        closing.treasurerSignature,
        'PNG',
        margin + 6,
        currentY + 5.5,
        sigBoxWidth - 12,
        14,
        undefined,
        'FAST'
      );
    } catch (e) {
      console.warn('Erro ao embutir imagem da assinatura do tesoureiro no PDF:', e);
    }
  }

  // Divider line for signature
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(margin + 6, currentY + 22, margin + sigBoxWidth - 6, currentY + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(closing.treasurerName || 'Tesoureiro Geral', margin + 6, currentY + 25.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Assinado em: ${formatDateTime(closing.closedAt)}`, margin + 6, currentY + 29);

  // Box 2: Dirigente / Approver Visto
  const dirBoxX = margin + sigBoxWidth + 10;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(dirBoxX, currentY, sigBoxWidth, sigBoxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('VISTO PASTORAL / SUPERINTENDÊNCIA', dirBoxX + 4, currentY + 4.5);

  if (closing.status === 'APROVADO') {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(dirBoxX + 12, currentY + 7, sigBoxWidth - 24, 10, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(5, 150, 105);
    doc.text('✓ VISTO ELETRÔNICO HOMOLOGADO', dirBoxX + 16, currentY + 13.5);
  } else {
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(253, 230, 138);
    doc.roundedRect(dirBoxX + 12, currentY + 7, sigBoxWidth - 24, 10, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(217, 119, 6);
    doc.text('AGUARDANDO VISTO DA DIREÇÃO', dirBoxX + 17, currentY + 13.5);
  }

  // Divider line for dirigente
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(dirBoxX + 6, currentY + 22, dirBoxX + sigBoxWidth - 6, currentY + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Pr. Carlos Mendes (Superintendente EBD)', dirBoxX + 6, currentY + 25.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    closing.dirigenteApprovedAt ? `Homologado em: ${formatDateTime(closing.dirigenteApprovedAt)}` : 'Visto pendente de registro',
    dirBoxX + 6,
    currentY + 29
  );

  currentY += sigBoxHeight + 6;

  // 9. Document Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Documento emitido automaticamente pelo Sistema EBD Finanças • ID Certificação: ${closing.id} • Página 1 de ${doc.getNumberOfPages()}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  // Save the PDF file
  const fileName = `EBD_Ata_Fechamento_${closing.closingNum}_${closing.startDate}_a_${closing.endDate}.pdf`;
  doc.save(fileName);
}

/**
 * Generates and downloads a General / Filtered Financial Report as PDF
 */
export async function exportGeneralFinancialReportToPDF(
  transactions: Transaction[],
  categories: Category[],
  boxes: Box[],
  filterInfo?: {
    startDate?: string;
    endDate?: string;
    boxId?: string;
    type?: string;
  }
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);

  let currentY = margin;

  // Header Banner
  doc.setFillColor(30, 41, 59); // Slate 850
  doc.rect(margin, currentY, contentWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ESCOLA BÍBLICA DOMINICAL (EBD) • IEADALPE', margin + 4, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text('Congregação Jardim Paulista Baixo • Relatório Consolidado de Tesouraria', margin + 4, currentY + 12.5);
  doc.text(`Emissão em: ${new Date().toLocaleString('pt-BR')}`, margin + 4, currentY + 17);

  currentY += 26;

  // Title
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('RELATÓRIO FINANCEIRO CONSOLIDADO', margin, currentY);

  currentY += 5;

  // Filter info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const periodText = filterInfo?.startDate && filterInfo?.endDate 
    ? `Período: ${formatDate(filterInfo.startDate)} até ${formatDate(filterInfo.endDate)}`
    : 'Período: Histórico Geral Completo';
  doc.text(periodText, margin, currentY);

  currentY += 4;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 5;

  // Calculate totals
  const approvedTxs = transactions.filter(t => t.isApproved !== false);
  const totalInflows = approvedTxs.filter(t => t.type === 'ENTRADA').reduce((s, t) => s + t.amount, 0);
  const totalOutflows = approvedTxs.filter(t => t.type === 'SAIDA').reduce((s, t) => s + t.amount, 0);
  const netBalance = totalInflows - totalOutflows;

  // KPI cards
  const cardWidth = (contentWidth - 6) / 3;
  const cardHeight = 15;
  const cards = [
    { label: 'Total Entradas (+)', value: formatCurrency(totalInflows), color: [16, 185, 129], bg: [236, 253, 245] },
    { label: 'Total Saídas (-)', value: formatCurrency(totalOutflows), color: [239, 68, 68], bg: [254, 242, 242] },
    { label: 'Saldo Líquido Apurado', value: formatCurrency(netBalance), color: [67, 56, 202], bg: [238, 242, 255] }
  ];

  cards.forEach((c, idx) => {
    const cardX = margin + idx * (cardWidth + 3);
    doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(c.label.toUpperCase(), cardX + 3, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(c.value, cardX + 3, currentY + 11);
  });

  currentY += cardHeight + 6;

  // Transactions table
  const tableData = transactions.map(t => {
    const cat = categories.find(c => c.id === t.categoryId);
    const box = boxes.find(b => b.id === t.boxId);
    return [
      t.transactionNum,
      formatDate(t.date),
      t.type === 'ENTRADA' ? 'Entrada' : 'Saída',
      box?.name ? box.name.replace('Caixa ', '') : t.boxId,
      cat?.name || 'Geral',
      t.responsible,
      t.description || '-',
      `${t.type === 'ENTRADA' ? '+' : '-'} ${formatCurrency(t.amount)}`
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Voucher', 'Data', 'Tipo', 'Caixa', 'Categoria', 'Responsável', 'Descrição', 'Valor']],
    body: tableData.length > 0 ? tableData : [['-', '-', '-', '-', '-', '-', 'Nenhuma transação encontrada', '-']],
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.8,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [71, 85, 105],
      fontStyle: 'bold',
      fontSize: 7
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250]
    },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold' },
      1: { cellWidth: 16 },
      2: { cellWidth: 14 },
      3: { cellWidth: 16 },
      4: { cellWidth: 20 },
      5: { cellWidth: 22 },
      6: { cellWidth: 'auto' },
      7: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 7) {
        const text = data.cell.raw as string;
        if (text.startsWith('+')) {
          data.cell.styles.textColor = [16, 185, 129];
        } else if (text.startsWith('-')) {
          data.cell.styles.textColor = [239, 68, 68];
        }
      }
    }
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `EBD Finanças • Relatório de Prestação de Contas • Página ${i} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  const fileName = `EBD_Relatorio_Financeiro_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
