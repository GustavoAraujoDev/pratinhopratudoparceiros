const API_URL = "https://prafoodapi.onrender.com/taxas";

let state = {
  taxas: [],
  filtroTexto: "",
  abaAtiva: "todos",
};

document.addEventListener("DOMContentLoaded", () => {
  carregarTaxas();
  configurarDebounceBusca();
});

async function carregarTaxas() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error();

    const dadosAPI = await response.json();

    // Tratamento Sênior: Garante que os novos campos existam mesmo se o banco antigo não tiver
    state.taxas = dadosAPI.map((item) => ({
      ...item,
      pedidoMinimo: item.pedidoMinimo !== undefined ? item.pedidoMinimo : 0,
      tempoMin: item.tempoMin !== undefined ? item.tempoMin : 30,
      tempoMax: item.tempoMax !== undefined ? item.tempoMax : 45,
    }));

    renderizarPainel();
    calcularKpis();
  } catch (error) {
    document.getElementById("lista-taxas-body").innerHTML = `
            <tr>
              <td colspan="6" class="px-6 py-12 text-center text-red-500 font-semibold">
                <i class="fa-solid fa-circle-exclamation text-2xl mb-2 block"></i>
                Não foi possível conectar com o servidor. Rode o backend.
              </td>
            </tr>`;
  }
}

function renderizarPainel() {
  const tbody = document.getElementById("lista-taxas-body");

  // Regras de negócio cruzadas (Texto da busca + Aba selecionada)
  let filtrados = state.taxas.filter((item) =>
    item.nome.toLowerCase().includes(state.filtroTexto.toLowerCase()),
  );

  if (state.abaAtiva === "ativos")
    filtrados = filtrados.filter((t) => t.isActive);
  if (state.abaAtiva === "inativos")
    filtrados = filtrados.filter((t) => !t.isActive);
  if (state.abaAtiva === "gratis")
    filtrados = filtrados.filter((t) => t.taxa === 0 && t.isActive);

  document.getElementById("contador-resultados").innerText =
    `Mostrando ${filtrados.length} regiões`;

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-10 text-center text-gray-400">Nenhum registro corresponde ao filtro aplicado.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  filtrados.forEach((item) => {
    const taxaTexto =
      item.taxa === 0
        ? `<span class="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg">Grátis</span>`
        : `R$ ${item.taxa.toFixed(2)}`;
    const minTexto =
      item.pedidoMinimo === 0
        ? "Sem Mínimo"
        : `R$ ${item.pedidoMinimo.toFixed(2)}`;
    const tempoTexto = `<i class="fa-regular fa-clock text-gray-400 mr-1"></i> ${item.tempoMin}-${item.tempoMax} min`;

    const badgeAtivo = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Ativo</span>`;
    const badgeInativo = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-red-50 text-red-600 rounded-full border border-red-100"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>Pausado</span>`;

    const safeNome = item.nome.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    tbody.innerHTML += `
            <tr class="hover:bg-gray-50/50 transition-colors">
              <td class="px-6 py-4 font-bold text-gray-900">${safeNome}</td>
              <td class="px-6 py-4 font-semibold text-gray-700">${taxaTexto}</td>
              <td class="px-6 py-4 text-gray-600 font-medium">${minTexto}</td>
              <td class="px-6 py-4 text-gray-600 font-medium">${tempoTexto}</td>
              <td class="px-6 py-4 text-center">${item.isActive ? badgeAtivo : badgeInativo}</td>
              <td class="px-6 py-4 text-right space-x-1 whitespace-nowrap">
                <button onclick="alternarStatusItem('${item._id}', ${item.isActive})" class="p-2 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-500 transition-all" title="Ligar/Desligar Bairro">
                  <i class="fa-solid ${item.isActive ? "fa-toggle-on text-emerald-500 text-base" : "fa-toggle-off text-gray-400 text-base"}"></i>
                </button>
                <button onclick="editarTaxa('${item._id}', '${safeNome}', ${item.taxa}, ${item.pedidoMinimo}, ${item.tempoMin}, ${item.tempoMax}, ${item.isActive})" class="text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 p-2 rounded-xl transition-all"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="deletarTaxa('${item._id}', '${safeNome}')" class="text-ifood-red hover:text-[#d91a29] bg-red-50 hover:bg-red-100 p-2 rounded-xl transition-all"><i class="fa-solid fa-trash-can"></i></button>
              </td>
            </tr>`;
  });
}

function calcularKpis() {
  const total = state.taxas.length;
  const inativos = state.taxas.filter((t) => !t.isActive).length;
  const totalTaxas = state.taxas.reduce((acc, curr) => acc + curr.taxa, 0);
  const totalTempos = state.taxas.reduce((acc, curr) => acc + curr.tempoMin, 0);

  const mediaTaxa = total > 0 ? (totalTaxas / total).toFixed(2) : "0.00";
  const mediaTempo = total > 0 ? Math.round(totalTempos / total) : 0;

  document.getElementById("kpi-total-bairros").innerText = total;
  document.getElementById("kpi-taxa-media").innerText = `R$ ${mediaTaxa}`;
  document.getElementById("kpi-tempo-medio").innerText = mediaTempo;
  document.getElementById("kpi-inativos").innerText = inativos;
}

/**
 * ⏱️ UX SÊNIOR: Debounce (Aguarda o cliente parar de digitar por 250ms antes de filtrar a tabela)
 */
function configurarDebounceBusca() {
  let timer;
  document.getElementById("input-busca").addEventListener("input", (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.filtroTexto = e.target.value;
      renderizarPainel();
    }, 250);
  });
}

function filtrarPorAba(nomeAba) {
  state.abaAtiva = nomeAba;

  // Muda classes visuais das abas
  ["todos", "ativos", "gratis", "inativos"].forEach((aba) => {
    const btn = document.getElementById(`aba-${aba}`);
    if (aba === nomeAba) {
      btn.className =
        "px-3 py-2 rounded-lg bg-white shadow-sm text-gray-900 transition-all";
    } else {
      btn.className = "px-3 py-2 rounded-lg hover:bg-white/50 transition-all";
    }
  });
  renderizarPainel();
}

/**
 * ➕ CREATE - Modal Completo para Venda
 */
function abrirModalCadastro() {
  Swal.fire({
    title: "Adicionar Região Logística",
    html: `
            <div class="text-left space-y-3">
              <div>
                <label class="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">Nome do Bairro</label>
                <input id="swal-nome" class="w-full p-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-ifood-red text-sm">
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">Taxa de Frete (R$)</label>
                  <input id="swal-taxa" type="number" step="0.01" class="w-full p-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-ifood-red text-sm" placeholder="0.00">
                </div>
                <div>
                  <label class="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">Pedido Mínimo (R$)</label>
                  <input id="swal-minimo" type="number" step="0.01" class="w-full p-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-ifood-red text-sm" value="0.00">
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">Tempo Mínimo (min)</label>
                  <input id="swal-tempomin" type="number" class="w-full p-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-ifood-red text-sm" value="30">
                </div>
                <div>
                  <label class="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">Tempo Máximo (min)</label>
                  <input id="swal-tempomax" type="number" class="w-full p-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-ifood-red text-sm" value="45">
                </div>
              </div>
            </div>`,
    showCancelButton: true,
    confirmButtonText: "Cadastrar Região",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#ea1d2c",
    preConfirm: () => {
      const nome = document.getElementById("swal-nome").value.trim();
      const taxa = parseFloat(document.getElementById("swal-taxa").value || 0);
      const pedidoMinimo = parseFloat(
        document.getElementById("swal-minimo").value || 0,
      );
      const tempoMin = parseInt(
        document.getElementById("swal-tempomin").value || 30,
      );
      const tempoMax = parseInt(
        document.getElementById("swal-tempomax").value || 45,
      );

      if (!nome)
        return Swal.showValidationMessage("Nome do bairro é obrigatório");
      if (taxa < 0 || pedidoMinimo < 0)
        return Swal.showValidationMessage("Valores não podem ser negativos");
      if (tempoMin >= tempoMax)
        return Swal.showValidationMessage(
          "Tempo máximo deve ser maior que o mínimo",
        );

      return {
        nome,
        taxa,
        pedidoMinimo,
        tempoMin,
        tempoMax,
        isActive: true,
      };
    },
  }).then((result) => {
    if (result.isConfirmed)
      executarRequisicao(
        API_URL,
        "POST",
        result.value,
        "Região criada com sucesso.",
      );
  });
}

/**
 * ✏️ UPDATE - Edição total de parâmetros comerciais
 */
function editarTaxa(
  id,
  nomeAtual,
  taxaAtual,
  minAtual,
  tMin,
  tMax,
  statusAtual,
) {
  Swal.fire({
    title: `Ajustar Parâmetros: ${nomeAtual}`,
    html: `
            <div class="text-left space-y-3">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">Taxa de Frete (R$)</label>
                  <input id="swal-edit-taxa" type="number" step="0.01" class="w-full p-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-ifood-red text-sm" value="${taxaAtual}">
                </div>
                <div>
                  <label class="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">Pedido Mínimo (R$)</label>
                  <input id="swal-edit-minimo" type="number" step="0.01" class="w-full p-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-ifood-red text-sm" value="${minAtual}">
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">Tempo Mínimo (min)</label>
                  <input id="swal-edit-tempomin" type="number" class="w-full p-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-ifood-red text-sm" value="${tMin}">
                </div>
                <div>
                  <label class="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">Tempo Máximo (min)</label>
                  <input id="swal-edit-tempomax" type="number" class="w-full p-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-ifood-red text-sm" value="${tMax}">
                </div>
              </div>
            </div>`,
    showCancelButton: true,
    confirmButtonText: "Atualizar Logística",
    cancelButtonText: "Voltar",
    confirmButtonColor: "#ea1d2c",
    preConfirm: () => {
      const taxa = parseFloat(
        document.getElementById("swal-edit-taxa").value || 0,
      );
      const pedidoMinimo = parseFloat(
        document.getElementById("swal-edit-minimo").value || 0,
      );
      const tempoMin = parseInt(
        document.getElementById("swal-edit-tempomin").value || 30,
      );
      const tempoMax = parseInt(
        document.getElementById("swal-edit-tempomax").value || 45,
      );

      if (taxa < 0 || pedidoMinimo < 0)
        return Swal.showValidationMessage("Valores inválidos");
      if (tempoMin >= tempoMax)
        return Swal.showValidationMessage("Tempo máximo inconsistente");

      return {
        nome: nomeAtual,
        taxa,
        pedidoMinimo,
        tempoMin,
        tempoMax,
        isActive: statusAtual,
      };
    },
  }).then((result) => {
    if (result.isConfirmed)
      executarRequisicao(
        `${API_URL}/${id}`,
        "PUT",
        result.value,
        "Dados comerciais salvos!",
      );
  });
}

/**
 * 🔄 QUICK STATUS SWITCH
 */
async function alternarStatusItem(id, statusAtual) {
  const item = state.taxas.find((t) => t._id === id);
  if (!item) return;

  item.isActive = !statusAtual;
  renderizarPainel();
  calcularKpis();

  try {
    await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
  } catch {
    item.isActive = statusAtual;
    renderizarPainel();
    calcularKpis();
  }
}

/**
 * 🌩️ MASS BULK TOGGLE (Fechamento Geral por Chuva ou Falta de Entregadores)
 */
function alternarStatusGeral(status) {
  Swal.fire({
    title: "Ativar Protocolo de Contingência?",
    text: "Isso fechará temporariamente o recebimento de pedidos em todos os bairros.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim, Suspender Operação",
    cancelButtonColor: "#9ca3af",
    confirmButtonColor: "#ea1d2c",
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "Bloqueando rotas...",
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false,
      });
      try {
        await Promise.all(
          state.taxas.map((b) =>
            fetch(`${API_URL}/${b._id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...b, isActive: status }),
            }),
          ),
        );
        Swal.fire({
          icon: "success",
          title: "Sucesso",
          text: "Toda a malha de entrega foi pausada.",
          timer: 1500,
          showConfirmButton: false,
        });
        carregarTaxas();
      } catch {
        Swal.fire({ icon: "error", title: "Erro na operação em lote" });
      }
    }
  });
}

/**
 * ❌ DELETE
 */
function deletarTaxa(id, nomeBairro) {
  Swal.fire({
    title: "Excluir Região?",
    text: `Pedidos vindo de ${nomeBairro} não serão mais processados.`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Remover",
    confirmButtonColor: "#ea1d2c",
  }).then((result) => {
    if (result.isConfirmed)
      executarRequisicao(`${API_URL}/${id}`, "DELETE", null, "Região apagada.");
  });
}

/**
 * 📄 EXPORTAR RELATÓRIO DE MERCADO (Faturamento / Auditoria de Motoboys)
 */
function exportarRelatorioCSV() {
  if (state.taxas.length === 0) return;

  let csv = "Bairro;Taxa de Entrega;Pedido Minimo;Tempo Min;Tempo Max;Status\n";
  state.taxas.forEach((b) => {
    csv += `${b.nome};${b.taxa};${b.pedidoMinimo};${b.tempoMin};${b.tempoMax};${b.isActive ? "Ativo" : "Pausado"}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute(
    "download",
    `logistica_pratinho_${new Date().toISOString().split("T")[0]}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 🛠️ CORE ENGINE REQUESTS
 */
async function executarRequisicao(url, metodo, bodyData, mensagemSucesso) {
  try {
    const config = {
      method: metodo,
      headers: { "Content-Type": "application/json" },
    };
    if (bodyData) config.body = JSON.stringify(bodyData);

    const response = await fetch(url, config);
    if (!response.ok) throw new Error();

    Swal.fire({
      icon: "success",
      title: "Sucesso!",
      text: mensagemSucesso,
      timer: 1500,
      showConfirmButton: false,
    });
    carregarTaxas();
  } catch {
    Swal.fire({
      icon: "error",
      title: "Erro na Requisição",
      text: "Verifique os dados informados ou o servidor.",
      confirmButtonColor: "#ea1d2c",
    });
  }
}
