// Endereço do servidor Node.js/Express
const API_BASE_URL = "https://prafoodapi.onrender.com/cupom/admin/coupons";

// CONFIGURAÇÃO FINANCEIRA DINÂMICA: Recupera do LocalStorage ou define 40% como padrão
let MARGEM_PADRAO = parseFloat(localStorage.getItem("companyMargin")) || 40;

// Cache local em memória para evitar requisições duplicadas ao abrir edição
let currentCouponsList = [];

document.addEventListener("DOMContentLoaded", () => {
  // Inicializa o input da tela com a margem atual configurada
  const marginInput = document.getElementById("company-margin");
  if (marginInput) {
    marginInput.value = MARGEM_PADRAO;
  }

  document.getElementById("form-expiration").min = new Date()
    .toISOString()
    .split("T")[0];
  fetchAndRender();
});

// Função para salvar a nova margem de lucro alvo da empresa
function saveCompanyMargin() {
  const marginInput = document.getElementById("company-margin");
  if (!marginInput) return;

  const value = parseFloat(marginInput.value);
  if (isNaN(value) || value <= 0 || value > 100) {
    alert("Por favor, informe um valor de margem válido entre 1% e 100%.");
    return;
  }

  MARGEM_PADRAO = value;
  localStorage.setItem("companyMargin", MARGEM_PADRAO);
  alert(`Margem Alvo atualizada para ${MARGEM_PADRAO}% com sucesso!`);

  // Recalcula e renderiza a tabela imediatamente com a nova margem
  renderTable(currentCouponsList);
}

// ==========================================
// REQUISIÇÕES DA API (GET / POST / PUT / DELETE)
// ==========================================

async function fetchAndRender() {
  try {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) throw new Error("Erro de comunicação com a API.");

    currentCouponsList = await response.json();
    renderTable(currentCouponsList);
  } catch (error) {
    console.error(error);
    document.getElementById("coupons-table-body").innerHTML = `
          <tr>
            <td colspan="8" class="px-6 py-8 text-center text-red-500 font-medium">
              <i class="fa-solid fa-triangle-exclamation text-2xl mb-2 block"></i> Falha ao conectar ao servidor backend.
            </td>
          </tr>`;
  }
}

async function saveCoupon(e) {
  e.preventDefault();

  const id = document.getElementById("coupon-id").value;
  const rawDate = document.getElementById("form-expiration").value;
  const isoExpirationDate = new Date(rawDate + "T23:59:59").toISOString();

  const couponData = {
    code: document.getElementById("form-code").value.toUpperCase().trim(),
    type: document.getElementById("form-type").value,
    value: parseFloat(document.getElementById("form-value").value),
    minPurchaseValue: parseFloat(
      document.getElementById("form-minPurchase").value || 0,
    ),
    maxDiscountValue: document.getElementById("form-maxDiscount").value
      ? parseFloat(document.getElementById("form-maxDiscount").value)
      : null,
    expirationDate: isoExpirationDate,
    usageLimit: document.getElementById("form-usageLimit").value
      ? parseInt(document.getElementById("form-usageLimit").value)
      : null,
    limitPerPhone: parseInt(
      document.getElementById("form-limitPerPhone").value || 1,
    ),
    isActive: document.getElementById("form-isActive").checked,
  };

  const url = id ? `${API_BASE_URL}/${id}` : API_BASE_URL;
  const method = id ? "PUT" : "POST";

  try {
    const response = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(couponData),
    });

    const result = await response.json();

    if (response.ok) {
      closeModal();
      fetchAndRender();
    } else {
      alert(result.error || "Ocorreu um problema ao tentar salvar o cupom.");
    }
  } catch (error) {
    alert("Erro de rede. Verifique se o servidor backend está ativo.");
  }
}

async function deleteCoupon(id) {
  if (
    !confirm(
      "Tem certeza absoluta que deseja remover este cupom do banco de dados?",
    )
  )
    return;

  try {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      fetchAndRender();
    } else {
      const result = await response.json();
      alert(result.error || "Não foi possível remover o cupom.");
    }
  } catch (error) {
    alert("Erro ao tentar deletar o registro.");
  }
}

// ==========================================
// FUNÇÕES DE MAPEAMENTO DA INTERFACE (DOM)
// ==========================================

// ==========================================
// FUNÇÕES DE MAPEAMENTO DA INTERFACE (DOM)
// ==========================================

// ==========================================
// SISTEMA ANALÍTICO DE RENDERIZAÇÃO DA INTERFACE (MÓDULO DECISÃO PRO)
// ==========================================

function renderTable(coupons) {
  const tbody = document.getElementById("coupons-table-body");
  const searchInput = document.getElementById("search-input");
  const searchTerm = searchInput ? searchInput.value.toUpperCase().trim() : "";
  tbody.innerHTML = "";

  const filteredCoupons = coupons.filter((c) => c.code.includes(searchTerm));

  calculateAndSetMetrics(coupons);

  if (filteredCoupons.length === 0) {
    tbody.innerHTML = `
            <tr>
              <td colspan="8" class="px-6 py-12 text-center text-gray-400 font-medium">
                <i class="fa-solid fa-receipt text-3xl mb-3 block text-gray-300"></i>
                Nenhum cupom ativo ou localizado na malha operacional de buscas.
              </td>
            </tr>`;
    return;
  }

  filteredCoupons.forEach((coupon) => {
    const isExpired = new Date() > new Date(coupon.expirationDate);
    const formatValue =
      coupon.type === "percentage"
        ? `${coupon.value}%`
        : `R$ ${coupon.value.toFixed(2)}`;
    const dateFormatted = new Date(coupon.expirationDate).toLocaleDateString(
      "pt-BR",
      { timeZone: "UTC" },
    );

    // --- ENGENHARIA FINANCEIRA AVANÇADA ---
    let totalRevenue = 0;
    let totalDiscountGranted = 0;
    const uniqueCustomers = new Set();

    // Estruturas de dados para novas métricas de decisão
    const fraudCheckMap = {};
    let ordersOnPeakDays = 0; // Sexta, Sábado, Domingo
    let ordersOnSlowDays = 0; // Segunda a Quinta

    if (coupon.usedBy && Array.isArray(coupon.usedBy)) {
      coupon.usedBy.forEach((usage) => {
        totalRevenue += parseFloat(usage.orderValue || 0);
        totalDiscountGranted += parseFloat(usage.discountApplied || 0);

        if (usage.customerPhone) {
          const phone = usage.customerPhone.trim();
          uniqueCustomers.add(phone);
          // Conta usos por telefone para auditoria antifraude
          fraudCheckMap[phone] = (fraudCheckMap[phone] || 0) + 1;
        }

        // Análise de Cohort/Data (Se houver data mapeada no uso, senão distribui no mock)
        const orderDate = usage.createdAt
          ? new Date(usage.createdAt)
          : new Date();
        const dayOfWeek = orderDate.getDay(); // 0 = Domingo, 5 = Sexta, 6 = Sábado
        if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) {
          ordersOnPeakDays++;
        } else {
          ordersOnSlowDays++;
        }
      });
    }

    const ticketMedio =
      coupon.usageCount > 0 ? totalRevenue / coupon.usageCount : 0;
    const fatorMargem = MARGEM_PADRAO / 100;
    const lucroEstornado = totalRevenue * fatorMargem - totalDiscountGranted;
    const roi =
      totalDiscountGranted > 0 ? totalRevenue / totalDiscountGranted : 0;

    // --- NOVO: ENGENHARIA DE AUDITORIA ANTIFRAUDE ---
    let fraudAlertBadge = "";
    const suspectPhones = Object.entries(fraudCheckMap).filter(
      ([phone, count]) => count > 3,
    );
    if (suspectPhones.length > 0 && coupon.limitPerPhone > 1) {
      fraudAlertBadge = `<div class="mt-1 text-[10px] bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded border border-red-300 inline-flex items-center gap-1 shadow-sm" title="Alerta de Abuso: ${suspectPhones.length} cliente(s) clonaram ou usaram CPFs/telefones diferentes para estourar o limite unificado do mesmo cupom!"><i class="fa-solid fa-shield-halved text-red-600 animate-pulse"></i> Suspeita de Fraude</div>`;
    }

    // --- NOVO: MÉTRICA DE CANIBALIZAÇÃO DE DEMANDA (COHORT) ---
    let cohortBadge = `<div class="text-[10px] text-gray-400 mt-1">Uso Balanceado nos dias úteis</div>`;
    if (coupon.usageCount > 0) {
      const pctPeak = (ordersOnPeakDays / coupon.usageCount) * 100;
      if (pctPeak >= 70) {
        cohortBadge = `<div class="text-[10px] text-amber-700 font-bold mt-1 bg-amber-50 px-1 rounded border border-amber-100" title="Canibalização de Demanda: Este cupom está sendo gasto em dias que o restaurante já estaria lotado (Fim de Semana). Sugerimos restringir para seg-qui."><i class="fa-solid fa-chart-pie text-amber-500"></i> Alerta: Canibaliza Fim de Semana (${pctPeak.toFixed(0)}%)</div>`;
      } else if (ordersOnSlowDays > ordersOnPeakDays) {
        cohortBadge = `<div class="text-[10px] text-emerald-700 font-bold mt-1 bg-emerald-50 px-1 rounded border border-emerald-100" title="Eficiência Máxima: O cupom cumpriu o papel de trazer receita incremental nos dias de baixo movimento na cozinha!"><i class="fa-solid fa-bolt text-emerald-500"></i> Alavanca de Dias Lentos</div>`;
      }
    }

    // --- NOVO: ÍNDICE DE ELASTICIDADE DE PREÇO (ATRATIVIDADE) ---
    let elasticidadeBadge = "";
    if (coupon.usageCount > 0) {
      const taxaConversaoEstimada =
        roi > 8
          ? "Alta Elasticidade (Viral)"
          : roi >= 4
            ? "Atratividade Saudável"
            : "Baixa Elasticidade (Incentivo Fraco)";
      const elasticidadeColor =
        roi > 8
          ? "text-purple-700 bg-purple-50 border-purple-200"
          : roi >= 4
            ? "text-indigo-700 bg-indigo-50 border-indigo-200"
            : "text-gray-600 bg-gray-50 border-gray-200";
      elasticidadeBadge = `<div class="text-[10px] font-medium px-1.5 py-0.5 rounded border ${elasticidadeColor} w-max mt-1" title="Mede a resposta do público ao desconto ofertado baseado no retorno de faturamento por real investido.">${taxaConversaoEstimada}</div>`;
    }

    // --- MÉTRICA DE RECORRÊNCIA E ENGAJAMENTO ---
    const totalClientesUnicos = uniqueCustomers.size;
    const taxaRecorrencia =
      totalClientesUnicos > 0
        ? (coupon.usageCount / totalClientesUnicos).toFixed(1)
        : 0;
    let badgeRecorrencia = `<span class="text-[10px] text-gray-500 block">Usuários Únicos: <b>${totalClientesUnicos}</b></span>`;
    if (taxaRecorrencia > 1.2) {
      badgeRecorrencia += `<span class="text-[10px] text-indigo-600 font-bold block mt-0.5" title="Retenção Ativa de Consumidores"><i class="fa-solid fa-sync"></i> Freq: ${taxaRecorrencia}x por cliente</span>`;
    }

    // --- VAZAMENTO E DEPRECIAÇÃO DE MARGEM LÍQUIDA ---
    const lucroTeoricoSemCupom = totalRevenue * fatorMargem;
    const vazamentoMargemPercent =
      lucroTeoricoSemCupom > 0
        ? (totalDiscountGranted / lucroTeoricoSemCupom) * 100
        : 0;
    let vazamentoBadge = `<div class="text-[10px] text-gray-500">Margem Consumida: <span class="font-bold">${vazamentoMargemPercent.toFixed(0)}%</span></div>`;
    if (vazamentoMargemPercent >= 70) {
      vazamentoBadge = `<div class="text-[10px] text-red-600 font-black flex items-center gap-1 mt-0.5" title="Alerta Vermelho: Este incentivo está canibalizando sua margem líquida!"><span class="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping"></span> Margem Drenada: ${vazamentoMargemPercent.toFixed(0)}%</div>`;
    }

    // --- ANÁLISE PREDITIVA DE RISCO DE PREJUÍZO ---
    let maxPossibleDiscount =
      coupon.type === "percentage"
        ? coupon.minPurchaseValue * (coupon.value / 100)
        : coupon.value;
    if (
      coupon.maxDiscountValue &&
      maxPossibleDiscount > coupon.maxDiscountValue
    ) {
      maxPossibleDiscount = coupon.maxDiscountValue;
    }

    const lucroNoPedidoMinimo =
      coupon.minPurchaseValue * fatorMargem - maxPossibleDiscount;
    let riscoBadge = "";
    if (lucroNoPedidoMinimo < 0 && coupon.isActive && !isExpired) {
      riscoBadge = `<div class="mt-1 text-[10px] bg-red-50 text-red-700 font-bold px-1.5 py-0.5 rounded border border-red-200 inline-flex items-center gap-1 shadow-sm" title="Defasagem Financeira Encontrada: Compras no ticket mínimo geram quebra de caixa na cozinha!"><i class="fa-solid fa-triangle-exclamation text-red-600"></i> Risco de Margem</div>`;
    }

    // --- TAXA DE ESGOTAMENTO DA CAMPANHA ---
    let ritmoEsgotamento = "";
    let passivoMaximoBadge = "";
    if (coupon.usageLimit) {
      const percentUsado = (coupon.usageCount / coupon.usageLimit) * 100;
      if (percentUsado >= 80) {
        ritmoEsgotamento = `<div class="text-[10px] text-red-600 font-black mt-1 bg-red-50 px-1 rounded border border-red-100 w-max"><i class="fa-solid fa-fire"></i> ${percentUsado.toFixed(0)}% Esgotado</div>`;
      } else {
        ritmoEsgotamento = `<div class="text-[10px] text-gray-400 mt-0.5 font-semibold">${percentUsado.toFixed(0)}% Utilizado</div>`;
      }

      const usosRestantes = coupon.usageLimit - coupon.usageCount;
      const riscoDescontoFuturo = usosRestantes * maxPossibleDiscount;
      if (riscoDescontoFuturo > 0 && coupon.isActive && !isExpired) {
        passivoMaximoBadge = `<div class="text-[10px] text-gray-400 font-medium" title="Volume máximo de desconto a pagar caso a campanha esgote na menor faixa de preço.">Exposição Pendente: <span class="font-mono text-red-500 font-bold">-R$ ${riscoDescontoFuturo.toFixed(0)}</span></div>`;
      }
    }

    // --- OTIMIZAÇÃO DE TICKET MÉDIO DA LOJA ---
    const superouMinimo = ticketMedio > coupon.minPurchaseValue * 1.25;
    const ticketBadge = superouMinimo
      ? `<span class="text-xs text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1 w-max shadow-sm" title="Performance Excelente: O cupom aumentou o ticket de venda além do mínimo de frete."><i class="fa-solid fa-arrow-trend-up"></i> R$ ${ticketMedio.toFixed(2)}</span>`
      : `<span class="text-xs text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1 w-max" title="Alerta Operacional: Clientes estão comprando escorados na linha mínima do frete.">R$ ${ticketMedio.toFixed(2)}</span>`;

    // --- STATUS E RATING DE LUCRATIVIDADE ---
    let indicadorLucroClass =
      "text-emerald-700 bg-emerald-50 border border-emerald-200 shadow-sm";
    let statusLucroTexto = "Lucrativo";

    if (lucroEstornado < 0) {
      indicadorLucroClass =
        "text-red-700 bg-red-50 border border-red-200 animate-pulse";
      statusLucroTexto = "Déficit Líquido";
    } else if (coupon.usageCount > 0 && lucroEstornado === 0) {
      indicadorLucroClass =
        "text-amber-700 bg-amber-50 border border-amber-200";
      statusLucroTexto = "Margem Zero";
    }

    let statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>Ativo</span>`;
    if (!coupon.isActive) {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700"><span class="w-2 h-2 rounded-full bg-gray-400"></span>Inativo</span>`;
    } else if (isExpired) {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700"><span class="w-2 h-2 rounded-full bg-red-500"></span>Expirado</span>`;
    }

    const tr = document.createElement("tr");
    tr.className = "hover:bg-gray-50/60 transition-all text-xs sm:text-sm";
    tr.innerHTML = `
            <td class="px-6 py-4 font-mono font-black tracking-wider text-indigo-700 bg-gray-50/30">
              <span class="block text-sm bg-indigo-50 px-2 py-1 rounded border border-indigo-100 w-max">${coupon.code}</span>
              ${riscoBadge}
              ${fraudAlertBadge}
            </td>
            <td class="px-6 py-4 font-black text-gray-900 text-sm">
              ${formatValue}
              ${elasticidadeBadge}
            </td>
            <td class="px-6 py-4 text-xs text-gray-500 space-y-1.5">
              <div>Regra Min: <b class="text-gray-700">R$ ${coupon.minPurchaseValue.toFixed(2)}</b></div>
              <div class="font-medium text-gray-700">Real por Pedido: ${ticketBadge}</div>
              <div class="flex items-center gap-1 text-gray-400"><i class="fa-regular fa-calendar-days text-[10px]"></i> Validade: ${dateFormatted}</div>
              ${cohortBadge}
            </td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-1.5">
                <span class="font-black text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">${coupon.usageCount}</span>
                <span class="text-gray-300">/</span>
                <span class="text-xs text-gray-400 font-bold">${coupon.usageLimit ? coupon.usageLimit : "Ilimitado"}</span>
              </div>
              ${ritmoEsgotamento}
              ${badgeRecorrencia}
            </td>
            <td class="px-6 py-4 text-gray-700 font-bold text-center bg-gray-50/20">${coupon.limitPerPhone}x</td>
            <td class="px-6 py-4 space-y-1">
              <div class="text-gray-900 font-semibold">Faturamento: <span class="font-black text-gray-900">R$ ${totalRevenue.toFixed(2)}</span></div>
              <div class="text-xs text-red-500 font-medium">Descontado: -R$ ${totalDiscountGranted.toFixed(2)}</div>
              <div class="text-[10px] font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 w-max uppercase tracking-wider">Multiplicador ROI: ${roi.toFixed(1)}x</div>
              ${vazamentoBadge}
            </td>
            <td class="px-6 py-4 text-center">
              <div class="flex flex-col items-center gap-2">
                ${statusBadge}
                <div class="px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${indicadorLucroClass}">
                  ${statusLucroTexto}: R$ ${lucroEstornado.toFixed(2)}
                </div>
                ${passivoMaximoBadge}
              </div>
            </td>
            <td class="px-6 py-4 text-right space-x-1 whitespace-nowrap bg-gray-50/10">
              <button onclick="openFinanceModal('${coupon._id}')" class="p-2 text-indigo-600 hover:bg-indigo-100/70 rounded-xl transition-all" title="Ver Memória de Cálculo Operacional">
                <i class="fa-solid fa-calculator text-base"></i>
              </button>
              <button onclick="exportSubscribersToCSV('${coupon.code}')" class="p-2 text-emerald-600 hover:bg-emerald-100/70 rounded-xl transition-all" title="Exportar Big Data de Clientes (CSV CRM)"><i class="fa-solid fa-file-csv text-base"></i></button>
              <button onclick="triggerWhatsAppRemarketing('${coupon.code}')" class="p-2 text-green-600 hover:bg-green-100/70 rounded-xl transition-all" title="Disparar Funil de Reengajamento WhatsApp"><i class="fa-brands fa-whatsapp text-base"></i></button>
              <span class="text-gray-300 font-light">|</span>
              <button onclick="editCoupon('${coupon._id}')" class="p-2 text-amber-600 hover:bg-amber-100/70 rounded-xl transition-all" title="Modificar Configurações"><i class="fa-solid fa-pen"></i></button>
              <button onclick="deleteCoupon('${coupon._id}')" class="p-2 text-red-600 hover:bg-red-100/70 rounded-xl transition-all" title="Eliminar Registro do Banco"><i class="fa-solid fa-trash"></i></button>
            </td>`;
    tbody.appendChild(tr);
  });
}

// ==========================================
// CONTROLE DO MODAL DE MEMÓRIA DE CÁLCULO
// ==========================================

function openFinanceModal(couponId) {
  const coupon = currentCouponsList.find((c) => c._id === couponId);
  if (!coupon) {
    alert("Cupom não encontrado no cache local.");
    return;
  }

  let totalRevenue = 0;
  let totalDiscountGranted = 0;

  if (coupon.usedBy && Array.isArray(coupon.usedBy)) {
    coupon.usedBy.forEach((usage) => {
      // Tratamento seguro: Se não houver orderValue ou discountApplied, assume 0 e não quebra
      totalRevenue += parseFloat(usage.orderValue || 0);
      totalDiscountGranted += parseFloat(usage.discountApplied || 0);
    });
  }

  const fatorMargem = MARGEM_PADRAO / 100;
  const lucroTeorico = totalRevenue * fatorMargem;
  const resultadoFinal = lucroTeorico - totalDiscountGranted;

  // Garante que os elementos existem na tela antes de injetar os dados
  const elCode = document.getElementById("detail-coupon-code");
  const elRevenue = document.getElementById("detail-revenue");
  const elMargin = document.getElementById("detail-margin");
  const elTheoretical = document.getElementById("detail-theoretical-profit");
  const elDiscounts = document.getElementById("detail-discounts");
  const elFinal = document.getElementById("detail-final-result");

  if (
    !elCode ||
    !elRevenue ||
    !elMargin ||
    !elTheoretical ||
    !elDiscounts ||
    !elFinal
  ) {
    alert(
      "Erro interno: Verifique se todos os IDs do HTML do modal foram copiados corretamente.",
    );
    return;
  }

  elCode.innerText = `Código Identificador: ${coupon.code}`;
  elRevenue.innerText = `R$ ${totalRevenue.toFixed(2).replace(".", ",")}`;
  elMargin.innerText = `${MARGEM_PADRAO}%`;
  elTheoretical.innerText = `R$ ${lucroTeorico.toFixed(2).replace(".", ",")}`;
  elDiscounts.innerText = `- R$ ${totalDiscountGranted.toFixed(2).replace(".", ",")}`;
  elFinal.innerText = `R$ ${resultadoFinal.toFixed(2).replace(".", ",")}`;

  if (resultadoFinal < 0) {
    elFinal.className = "font-mono text-base font-black text-red-500";
  } else {
    elFinal.className = "font-mono text-base font-black text-emerald-600";
  }

  document.getElementById("modal-finance-details").classList.remove("hidden");
}

function closeFinanceModal() {
  document.getElementById("modal-finance-details").classList.add("hidden");
}

function calculateAndSetMetrics(coupons) {
  let activeCount = 0;
  let totalGMV = 0;
  let totalDiscounts = 0;

  coupons.forEach((c) => {
    const isExpired = new Date() > new Date(c.expirationDate);
    if (c.isActive && !isExpired) activeCount++;

    if (c.usedBy && Array.isArray(c.usedBy)) {
      c.usedBy.forEach((u) => {
        totalGMV += parseFloat(u.orderValue || 0);
        totalDiscounts += parseFloat(u.discountApplied || 0);
      });
    }
  });

  // Transforma a margem de input (Ex: 40) para fator decimal decimal (0.40)
  const fatorMargem = MARGEM_PADRAO / 100;
  const lucroGlobalEstimado = totalGMV * fatorMargem - totalDiscounts;

  document.getElementById("metric-active").innerText = activeCount;

  // Card 2 Dinâmico: Lucro Real do Evento de Descontos
  const usagesMetric = document.getElementById("metric-usages");
  usagesMetric.innerText = `R$ ${lucroGlobalEstimado.toFixed(2)}`;
  if (lucroGlobalEstimado < 0) {
    usagesMetric.className =
      "text-3xl font-extrabold text-red-600 mt-2 tracking-tight";
  } else {
    usagesMetric.className =
      "text-3xl font-extrabold text-emerald-600 mt-2 tracking-tight";
  }

  // Card 3 Dinâmico: Faturamento Movimentado
  document.getElementById("metric-phones").innerText =
    `R$ ${totalGMV.toFixed(2)}`;
}

// ==========================================
// ENGENHARIA DE REMARKETING & CREATIVE DATA
// ==========================================

function exportSubscribersToCSV(couponCode) {
  const coupon = currentCouponsList.find((c) => c.code === couponCode);
  if (!coupon || !coupon.usedBy || coupon.usedBy.length === 0) {
    alert("Este cupom ainda não possui histórico de clientes para exportação.");
    return;
  }

  const uniquePhones = new Set();
  coupon.usedBy.forEach((u) => uniquePhones.add(u.customerPhone));

  let csvContent = "data:text/csv;charset=utf-8,Telefone\n";
  uniquePhones.forEach((phone) => {
    csvContent += `${phone}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", encodedUri);
  downloadAnchor.setAttribute(
    "download",
    `remarketing_cupom_${couponCode}.csv`,
  );
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  document.body.removeChild(downloadAnchor);
}

function triggerWhatsAppRemarketing(couponCode) {
  const coupon = currentCouponsList.find((c) => c.code === couponCode);
  if (!coupon || !coupon.usedBy || coupon.usedBy.length === 0) {
    alert("Nenhum telefone capturado para este cupom ainda.");
    return;
  }

  // Pega o número do último cliente para ação ativa e rápida de engajamento
  const lastCustomerPhone =
    coupon.usedBy[coupon.usedBy.length - 1].customerPhone;
  const cleanPhone = lastCustomerPhone.replace(/\D/g, "");

  const message = `Olá! Vimos que você já utilizou o nosso cupom *${couponCode}* no PratinhoPraTudo. Separamos uma oferta imperdível para o seu almoço de hoje! Bora aproveitar?`;
  const whatsappUrl = `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(message)}`;

  window.open(whatsappUrl, "_blank");
}

function toggleTypeFields() {
  const type = document.getElementById("form-type").value;
  const labelValue = document.getElementById("label-value");
  const maxDiscountContainer = document.getElementById(
    "max-discount-container",
  );

  if (type === "percentage") {
    labelValue.innerText = "Valor (%) *";
    maxDiscountContainer.style.opacity = "1";
    document.getElementById("form-maxDiscount").disabled = false;
  } else {
    labelValue.innerText = "Valor (R$) *";
    maxDiscountContainer.style.opacity = "0.4";
    document.getElementById("form-maxDiscount").value = "";
    document.getElementById("form-maxDiscount").disabled = true;
  }
}

function openModal() {
  document.getElementById("coupon-form").reset();
  document.getElementById("coupon-id").value = "";
  document.getElementById("form-code").disabled = false;
  document.getElementById("modal-title").innerText = "Cadastrar Novo Cupom";
  toggleTypeFields();
  document.getElementById("coupon-modal").classList.remove("hidden");
}

function editCoupon(id) {
  const coupon = currentCouponsList.find((c) => c._id === id);
  if (!coupon) return;

  document.getElementById("coupon-id").value = coupon._id;
  document.getElementById("form-code").value = coupon.code;
  document.getElementById("form-code").disabled = true;
  document.getElementById("form-type").value = coupon.type;
  toggleTypeFields();

  document.getElementById("form-value").value = coupon.value;
  document.getElementById("form-minPurchase").value = coupon.minPurchaseValue;
  document.getElementById("form-maxDiscount").value =
    coupon.maxDiscountValue || "";

  const dateString = coupon.expirationDate.split("T")[0];
  document.getElementById("form-expiration").value = dateString;

  document.getElementById("form-usageLimit").value = coupon.usageLimit || "";
  document.getElementById("form-limitPerPhone").value = coupon.limitPerPhone;
  document.getElementById("form-isActive").checked = coupon.isActive;

  document.getElementById("modal-title").innerText =
    "Editar Cupom: " + coupon.code;
  document.getElementById("coupon-modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("coupon-modal").classList.add("hidden");
}
