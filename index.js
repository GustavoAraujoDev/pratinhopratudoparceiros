/**
 * ============================================================================
 * 🎯 PAINEL ADMINISTRATIVO - CONFIGURAÇÕES GLOBAIS E ESTADOS
 * ============================================================================
 */

// 🌐 Endpoints e Recursos Estáticos
const API_URL = "https://prafoodapi.onrender.com/products";

// 🔮 Instância Base de Alertas Flutuantes (SweetAlert2)
const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 4000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener("mouseenter", Swal.stopTimer);
    toast.addEventListener("mouseleave", Swal.resumeTimer);
  },
});

// 🧠 Estados Globais da Aplicação (Memória Cache)
let currentUser = null; // Armazena a sessão e privilégios do usuário logado
let allProductsGlobal = null; // Cache global de produtos para filtros e manipulações rápidas

/**
 * ============================================================================
 * 🔐 MÓDULO DE AUTENTICAÇÃO E CONTROLE DE ACESSO (AUTH)
 * ============================================================================
 */

/**
 * Ouvinte do Formulário de Login
 * Gerencia a submissão, verificação de credenciais e validação de regras de nível administrativo (Role ADMIN).
 */
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  // 🛡️ TRAVA PROFISSIONAL CONTRA DUPLA REQUISIÇÃO
  const submitButton = e.target.querySelector('button[type="submit"]');
  const originalButtonText = submitButton ? submitButton.innerHTML : "";

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Autenticando...`; // Feedback visual profissional
  }

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-pass").value;

  try {
    // 📡 1. Autenticação inicial baseada em sessão por Cookies (HttpOnly)
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    if (!response.ok) throw new Error(data.message || "Falha no login");

    // 🔎 2. Busca os dados detalhados do usuário para validação de privilégios
    await fetchUserData();

    // 🛡️ 3. Validação de segurança de escopo: Bloqueia perfis que não sejam administradores
    if (!currentUser || currentUser.role !== "ADMIN") {
      audioAlerta.play();
      Toast.fire({
        icon: "error",
        title: "Acesso Negado",
        text: "Sua conta não tem permissão de administrador.",
      });
      return;
    }

    // 🎉 4. Autorização concedida com sucesso
    Toast.fire({
      icon: "success",
      title: "Acesso Liberado ",
      text: "Sua conta tem permissão de administrador.",
    });

    showDashboard();
  } catch (err) {
    alert("Erro: " + err.message);
  } finally {
    // 🔄 LIBERA O BOTÃO: O bloco 'finally' garante a execução mesmo se houver erro ou acertos
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonText; // Restaura o estado e o texto original
    }
  }
});
/**
 * Recupera o perfil do usuário logado na sessão ativa.
 * Injeta o status da loja e atualiza o estado global `currentUser`.
 */
async function fetchUserData() {
  try {
    const response = await fetch(`${API_URL}/users/me`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) throw new Error("Erro ao carregar perfil");

    currentUser = await response.json();
    renderStoreStatus(currentUser);
  } catch (err) {
    console.error("Erro ao buscar dados do usuário:", err);
  }
}

/**
 * Encerra a sessão ativa do usuário tanto no servidor quanto no cliente.
 * Destrói cookies de autenticação e limpa o estado de memória.
 */
async function logout() {
  try {
    // 📡 1. Sinaliza o Backend para invalidar e destruir o Token/Cookie de Sessão
    await fetch(`${API_URL}/logout`, {
      method: "POST",
      credentials: "include", // ESSENCIAL para o navegador enviar/receber cookies e limpar o cabeçalho Set-Cookie
    });
  } catch (err) {
    console.error("Erro ao falar com o servidor no logout:", err);
  } finally {
    // 🧹 2. Limpa o cache de memória local
    currentUser = null;

    // 🔄 3. Força o reset de rotas e recarrega a aplicação limpando possíveis rastros de memória
    window.location.hash = "auth";
    window.location.reload();
  }
}

/**
 * ============================================================================
 * 🖥️ MÓDULO DE INTERFACE VISUAL (DOM & FLUXO DE TELAS)
 * ============================================================================
 */

/**
 * Altera o estado visual das telas do ecossistema.
 * Oculta a interface de autenticação e inicializa o carregamento dos módulos do Dashboard.
 */
function showDashboard() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("main-app").classList.remove("hidden");
  loadProducts();
}

/**
 * ============================================================================
 * 📦 MÓDULO DE PRODUTOS (CATÁLOGO & INTEGRAÇÃO DE DADOS)
 * ============================================================================
 */

/**
 * Requisita a listagem completa de produtos cadastrados na base de dados.
 * Normaliza retornos em diferentes estruturas, alimenta o cache global e dispara seletores visuais.
 */
async function loadProducts() {
  try {
    const res = await fetch(API_URL, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();

    // 📊 Normalização de payload da API (Suporta Arrays diretos ou encapsulados em objetos .data)
    const products = Array.isArray(data) ? data : data.data || [];

    // 🔥 CACHE DE SEGURANÇA: Registra os dados no escopo global para manipulação de filtros e sub-rotinas
    allProductsGlobal = products;

    // 🗺️ Dispara a atualização dos componentes visuais dependentes
    populateCategoryFilter(products);
    renderTable(products);
  } catch (err) {
    console.error("Erro ao listar:", err);
  }
}

/**
 * ============================================================================
 * 🎛️ COMPONENTES VISUAIS (SELECTORS & RENDERS)
 * ============================================================================
 */

/**
 * Preenche dinamicamente o menu de seleção (<select>) de categorias.
 * Agrupa os IDs de categorias presentes no catálogo atual, remove duplicidades
 * e formata a exibição com a primeira letra em maiúscula.
 * * @param {Array} products - Lista de produtos carregada do backend
 */
function populateCategoryFilter(products) {
  const select = document.getElementById("filter-menu-cat");

  // 1. Mapeia todas as categorias dos produtos
  // Se o seu produto tiver um objeto de categoria ex: p.category.name, mude para p.category.name
  const categories = products.map((p) => p.categoryId).filter(Boolean);

  // 2. Remove duplicadas usando o Set
  const uniqueCategories = [...new Set(categories)];

  // 3. Mantém a opção "Todas" e renderiza as categorias dinâmicas
  select.innerHTML = `<option value="all">Todas as Categorias</option>`;

  uniqueCategories.forEach((cat) => {
    // Tratamos para exibição visual (Primeira letra Maiúscula) se necessário
    const formattedName = cat.charAt(0).toUpperCase() + cat.slice(1);

    select.innerHTML += `<option value="${cat}">${formattedName}</option>`;
  });
}

/**
 * Renderiza as linhas da tabela de gerenciamento de produtos (DataGrid).
 * Injeta dinamicamente estados visuais de subitens (Modificadores), badges de
 * categorias, controles rápidos de adição/subtração de estoque por SKU e chaves de ativação.
 * * @param {Array} products - Coleção filtrada ou completa de produtos cadastrados
 */
function renderTable(products) {
  const container = document.getElementById("product-list");
  if (products.length === 0) {
    container.innerHTML = `<tr><td colspan="6" class="p-10 text-center text-gray-400">Nenhum item cadastrado.</td></tr>`;
    return;
  }

  container.innerHTML = products
    .map((p) => {
      const isActive = p.status === "ACTIVE";
      const statusClass = isActive
        ? "text-green-600 bg-green-50 border-green-200"
        : "text-gray-400 bg-gray-50 border-gray-200";
      const iconClass = isActive ? "fa-toggle-on" : "fa-toggle-off";

      return `
        <tr class="border-b hover:bg-gray-50 transition align-top">
            <td class="px-6 py-4">
                <div class="font-bold text-gray-800 text-lg">${p.name}</div>
                <div class="text-xs text-gray-400 truncate w-48 mb-2">${p.description}</div>
                
                <div class="mt-2 space-y-2">
                    ${
                      p.modifiers && p.modifiers.length > 0
                        ? p.modifiers
                            .map(
                              (group) => `
                        <div class="bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                            <p class="text-[10px] font-black uppercase text-blue-600 mb-1">${group.name}</p>
                            <div class="flex flex-wrap gap-1">
                                ${group.items
                                  .map((item) => {
                                    const itemActive = item.status === "ACTIVE";
                                    return `
                                        <span class="text-[10px] px-2 py-0.5 rounded-full border ${itemActive ? "bg-white border-green-200 text-green-700" : "bg-gray-100 border-gray-300 text-gray-400 line-through"}">
                                            ${itemActive ? "🟢" : "🔴"} ${item.name}
                                        </span>
                                    `;
                                  })
                                  .join("")}
                            </div>
                        </div>
                      `,
                            )
                            .join("")
                        : '<span class="text-xs text-gray-300 italic">Sem opcionais</span>'
                    }
                </div>
            </td>

            <td class="px-6 py-4">
                <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-bold uppercase border border-gray-200">
                    ${p.categoryId}
                </span>
            </td>

            <td class="px-6 py-4">
                <div class="font-bold text-gray-800">R$ ${parseFloat(p.basePrice).toFixed(2)}</div>
                <div class="text-[10px] text-gray-400">Preço base</div>
            </td>
            
            <td class="px-6 py-4">
                <div class="flex flex-col gap-2">
                    <p class="text-[10px] font-bold text-gray-400 uppercase">Estoque (SKUs)</p>
                    ${p.skus
                      .map(
                        (sku) => `
                        <div class="flex items-center justify-between bg-white p-1.5 rounded border border-gray-200 shadow-sm">
                            <span class="text-[11px] font-medium text-gray-700">${sku.name}: <b>${sku.stock}</b></span>
                            <div class="flex gap-1 ml-4">
                                <button onclick="handleStock('${p.id}', '${sku._id}', 'add')" class="text-green-500 hover:scale-110 transition">
                                    <i class="fas fa-plus-circle"></i>
                                </button>
                                <button onclick="handleStock('${p.id}', '${sku._id}', 'sell')" class="text-orange-500 hover:scale-110 transition">
                                    <i class="fas fa-minus-circle"></i>
                                </button>
                            </div>
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            </td>

            <td class="px-6 py-4 text-center">
                <button onclick="toggleStatus('${p.id}', '${p.status}')" 
                        class="flex flex-col items-center gap-1 mx-auto px-4 py-2 rounded-xl border transition-all ${statusClass}">
                    <i class="fas ${iconClass} text-xl"></i>
                    <span class="text-[10px] font-black uppercase">${isActive ? "VENDENDO" : "PAUSADO"}</span>
                </button>
            </td>

            <td class="px-6 py-4 text-right">
                <div class="flex flex-col gap-2">
                    <button onclick="editProduct('${p.id}')" class="text-blue-500 hover:text-blue-700 p-2 bg-blue-50 rounded-lg transition">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteProduct('${p.id}')" class="text-gray-300 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
    })
    .join("");
}

/**
 * ============================================================================
 * 🔄 MÓDULO DE INTERAÇÕES E REQUISIÇÕES (MUTATIONS)
 * ============================================================================
 */

/**
 * Altera de forma alternada o status de ativação comercial de um produto específico.
 * Dispara feedbacks visuais imediatos baseados na resposta da API e previne travamentos
 * de fluxo capturando rejeições de reprodução de áudio impostas por browsers.
 * * @param {string} productId - ID corporativo/comercial do produto
 * @param {string} currentStatus - Estado de ativação atual ("ACTIVE" ou "INACTIVE")
 */
async function toggleStatus(productId, currentStatus) {
  const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  try {
    const response = await fetch(`${API_URL}/status`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: productId, status: newStatus }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data.message || data.error || "Erro desconhecido no servidor";

      Toast.fire({
        icon: "error",
        title: `Erro: ${errorMsg}`,
      });

      throw new Error(errorMsg);
    }

    
    Toast.fire({
      icon: "success",
      title: `Produto ${newStatus === "ACTIVE" ? "Ativado" : "Desativado"} com sucesso!`,
    });

    // Se houver função de recarregar a lista, chame-a aqui
    if (typeof loadProducts === "function") loadProducts();
  } catch (error) {
    console.error("Erro:", error);

    // Se o erro não for o que já mostramos acima (ex: erro de rede)
    if (!error.message.includes("Erro na requisição")) {
     
      Toast.fire({
        icon: "warning",
        title: "Não foi possível conectar ao servidor.",
      });
    }
  }
}

/**
 * ============================================================================
 * 🔄 MÓDULO DE INTERAÇÕES E REQUISIÇÕES (MUTATIONS)
 * ============================================================================
 */

/**
 * Altera de forma alternada o status comercial da loja (Aberta / Fechada).
 * Sincroniza o estado de sessão local do usuário, dispara rotinas secundárias de
 * recarga e emite feedbacks visuais e auditivos baseados na resposta do servidor.
 * @param {string} userId - ID único do usuário administrador logado
 * @param {string} currentStatus - Estado atual de disponibilidade da loja ("ACTIVE" ou "INACTIVE")
 */

async function toggleUserStatus(userId, currentStatus) {
  // Conforme o seu Schema, usamos 'ACTIVE' (maiúsculo) e 'inactive' (minúsculo)
  const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  try {
    const response = await fetch(`${API_URL}/storestatus`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: userId, status: newStatus }),
    });

    const data = await response.json();

    if (response.ok) {
      // Atualiza o estado local para o botão refletir a mudança na hora
      currentUser.storeStatus = newStatus;
      renderStoreStatus(currentUser);
      loadProducts();

      Toast.fire({
        icon: "success",
        title: `Loja ${newStatus === "ACTIVE" ? "Aberta" : "Fechada"}!`,
      });
    } else {
      const errorMsg =
        data.message || data.error || "Erro desconhecido no servidor";

      // Alerta sonoro e visual de erro
      audioAlerta.play().catch(() => {});
      Toast.fire({
        icon: "error",
        title: `Erro: ${errorMsg}`,
      });

      throw new Error(errorMsg);
    }

    Toast.fire({
      icon: "success",
      title: `Loja ${newStatus === "ACTIVE" ? "Ativada" : "Desativada"} com sucesso!`,
    });

    // Recarrega a lista de usuários se a função existir
    if (typeof loadUsers === "function") loadUsers();
  } catch (error) {
    console.error("Erro ao atualizar status do usuário:", error);

    if (!error.message.includes("Erro na requisição")) {
      Toast.fire({
        icon: "warning",
        title: "Não foi possível conectar ao servidor.",
      });
    }
  }
}

/**
 * ============================================================================
 * 🛠️ CONSTRUTORES DINÂMICOS DO CARDÁPIO (DOM INJECTION)
 * ============================================================================
 */

/**
 * Cria e injeta um novo grupo de modificadores (Adicionais/Opcionais) na interface.
 * Gera uma chave aleatória temporária baseada em string alfanumérica de base 36
 * para ancoragem e controle dos subitens associados.
 */
function addGroup() {
  const container = document.getElementById("modifiers-container"); // ou o ID do seu container de grupos
  const groupId = "group-" + Math.random().toString(36).substr(2, 9);

  const div = document.createElement("div");
  div.className =
    "bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4 group-box";
  div.dataset.id = groupId;

  div.innerHTML = `
        <div class="flex flex-wrap gap-2 mb-4 items-center border-b pb-2">
            <input type="text" placeholder="Nome do Grupo (Ex: Proteínas)" class="group-name font-bold p-2 border rounded flex-1 bg-white">
            <div class="flex items-center gap-2 text-xs">
                <span>Mín:</span>
                <input type="number" class="group-min w-12 p-1 border rounded" value="1">
                <span>Máx:</span>
                <input type="number" class="group-max w-12 p-1 border rounded" value="1">
            </div>
            <button type="button" onclick="this.parentElement.parentElement.remove()" class="text-red-500 text-xs font-bold uppercase">Remover Grupo</button>
        </div>
        
        <div class="items-list space-y-2 mb-3">
            </div>
        
        <button type="button" onclick="addItemToGroup('${groupId}')" class="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-xs font-bold border border-blue-200 hover:bg-blue-100">
            + Adicionar Opção (Ex: Frango)
        </button>
    `;
  container.appendChild(div);
}

/**
 * Vincula e renderiza uma nova linha de opção/ingrediente específico dentro de um grupo delimitado.
 * Define validadores nativos de obrigatoriedade e seletores de status visual.
 * @param {string} groupId - ID único identificador do grupo pai de ancoragem
 */
function addItemToGroup(groupId) {
  const groupDiv = document.querySelector(`[data-id="${groupId}"] .items-list`);
  const div = document.createElement("div");
  div.className =
    "flex gap-2 items-center bg-white p-2 rounded-lg border border-gray-100 item-row shadow-sm";

  div.innerHTML = `
        <input type="text" placeholder="Nome do item" class="item-name p-1 border rounded text-sm flex-1" required>
        <input type="number" step="0.01" placeholder="Preço" class="item-price p-1 border rounded text-sm w-20" value="0">
        
        <select class="item-status p-1 border rounded text-sm font-bold bg-gray-50 cursor-pointer">
            <option value="ACTIVE" class="text-green-600">🟢 ATIVO</option>
            <option value="INACTIVE" class="text-red-600">🔴 INATIVO</option>
        </select>
        
        <button type="button" onclick="this.parentElement.remove()" class="text-gray-400 hover:text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
        </button>
    `;
  groupDiv.appendChild(div);
}

addGroup();

/**
 * Cria e anexa uma nova estrutura de formulário para gerenciamento de SKUs (Variações).
 * Constrói de forma acoplada uma sub-grade interna voltada ao cadastro de mapeamento de Atributos Chave/Valor.
 */
function addSkuRow() {
  const container = document.getElementById("skus-container");
  const div = document.createElement("div");
  div.className = "bg-white border p-4 rounded-xl shadow-sm space-y-3 sku-row";

  div.innerHTML = `
        <div class="grid grid-cols-3 gap-3">
            <input type="text" placeholder="Nome (Ex: Pizza G)" class="sku-name p-2 border rounded-lg text-sm font-bold" required>
            <input type="number" step="0.01" placeholder="Preço (R$)" class="sku-price p-2 border rounded-lg text-sm" required>
            <input type="number" placeholder="Estoque" class="sku-stock p-2 border rounded-lg text-sm">
        </div>
        
        <div class="bg-gray-50 p-2 rounded-lg">
            <p class="text-[10px] uppercase font-black text-gray-400 mb-2">Atributos (Ex: Sabor: Carne / Tamanho: G)</p>
            <div class="attributes-list space-y-2">
                <div class="flex gap-2 attr-pair">
                    <input type="text" placeholder="Chave (Ex: Sabor)" class="attr-key w-1/2 p-1 border rounded text-xs">
                    <input type="text" placeholder="Valor (Ex: Carne)" class="attr-val w-1/2 p-1 border rounded text-xs">
                </div>
            </div>
            <button type="button" onclick="addAttrField(this)" class="text-[10px] text-blue-500 mt-2 hover:underline">+ Atributo extra</button>
        </div>

        <button type="button" onclick="this.parentElement.remove()" class="text-red-500 text-xs font-bold uppercase">Excluir Variação</button>
    `;
  container.appendChild(div);
}

// Função auxiliar para adicionar mais de um atributo por SKU (ex: Sabor E Tamanho)
function addAttrField(btn) {
  const list = btn.previousElementSibling;
  const div = document.createElement("div");
  div.className = "flex gap-2 attr-pair"; // ADICIONE A CLASSE attr-pair AQUI
  div.innerHTML = `
        <input type="text" placeholder="Chave" class="attr-key w-1/2 p-1 border rounded text-xs">
        <input type="text" placeholder="Valor" class="attr-val w-1/2 p-1 border rounded text-xs">
    `;
  list.appendChild(div);
}

// Inicializa com uma linha de cada
addSkuRow();

/**
 * ============================================================================
 * 📦 MÓDULO DE PRODUTOS - FORMULÁRIO E PERSISTÊNCIA
 * ============================================================================
 */

/**
 * Ouvinte do Evento de Submissão do Formulário de Produtos.
 * Extrai recursivamente a árvore do DOM para construir o payload estruturado (SKUs e Modificadores),
 * gerencia o estado do botão para mitigar cliques concorrentes (duplo clique) e persiste via REST API.
 */
document
  .getElementById("product-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitButton = e.target.querySelector('button[type="submit"]');
    const productId = document.getElementById("prod-id").value;
    const isEdit = productId !== "";
    const allAttributeKeys = new Set();

    // 1. Coletar SKUs (Variantes)
    const skus = Array.from(document.querySelectorAll(".sku-row")).map(
      (row) => {
        const skuObj = {
          name: row.querySelector(".sku-name").value,
          price: parseFloat(row.querySelector(".sku-price").value) || 0,
          stock: parseInt(row.querySelector(".sku-stock").value) || 0,
          attributes: {},
        };

        row.querySelectorAll(".attr-pair").forEach((pair) => {
          const inputChave = pair.querySelector(".attr-key");
          const inputValor = pair.querySelector(".attr-val");

          if (inputChave && inputValor) {
            const k = inputChave.value.trim();
            const v = inputValor.value.trim();

            if (k && v) {
              skuObj.attributes[k] = v;
              allAttributeKeys.add(k);
            }
          }
        });
        return skuObj;
      },
    );

    // 2. Coletar Modifiers (Adicionais) com ID Comercial garantido
    const modifierGroups = Array.from(
      document.querySelectorAll(".group-box"),
    ).map((group) => {
      const minVal = parseInt(group.querySelector(".group-min").value) || 0;
      return {
        name: group.querySelector(".group-name").value,
        required: minVal > 0,
        min: minVal,
        max: parseInt(group.querySelector(".group-max").value) || 1,
        items: Array.from(group.querySelectorAll(".item-row")).map((item) => {
          return {
            name: item.querySelector(".item-name").value,
            price: parseFloat(item.querySelector(".item-price").value) || 0,
            status: item.querySelector(".item-status").value,
          };
        }),
      };
    });

    // 3. Montar Objeto Final
    const productData = {
      name: document.getElementById("prod-name").value.trim(),
      description: document.getElementById("prod-description").value.trim(),
      basePrice:
        parseFloat(document.getElementById("prod-base-price").value) || 0,
      images: [
        document.getElementById("prod-image").value.trim() ||
          "https://site.com/placeholder.png",
      ],
      categoryId: document.getElementById("prod-cat-id").value,
      attribute_keys: Array.from(allAttributeKeys),
      status: "ACTIVE",
      skus: skus,
      modifiers: modifierGroups,
      availability: {
        days: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
        start: document.getElementById("avail-start").value || "00:00",
        end: document.getElementById("avail-end").value || "23:59",
      },
    };

    // 4. Enviar para API com bloqueio de concorrência (UX Sênior)
    try {
      if (submitButton) submitButton.disabled = true; // Evita duplo clique

      const url = isEdit ? `${API_URL}/${productId}` : API_URL;
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (result.errors) {
          throw new Error("Campos inválidos:\n- " + result.errors.join("\n- "));
        }
        throw new Error(
          result.error || result.message || "Erro desconhecido na API",
        );
      }

      Toast.fire({
        icon: "success",
        title: "Produto e variações salvos com sucesso!",
      });

      closeModal();
      if (typeof loadProducts === "function") loadProducts(); // Atualiza a lista dinamicamente se a função existir
    } catch (err) {
      console.error("Erro completo capturado:", err);

      Swal.fire({
        icon: "error",
        title: "Ops! Ocorreu um erro",
        text: err.message,
        confirmButtonColor: "#dc2626",
        confirmButtonText: "Entendido",
      });
    } finally {
      if (submitButton) submitButton.disabled = false; // Libera o botão
    }
  });

/**
 * ============================================================================
 * 🖥️ MÓDULO DE INTERFACE VISUAL - HIDRATAÇÃO DO FORMULÁRIO (EDIT)
 * ============================================================================
 */

/**
 * Requisita os dados detalhados de um produto e injeta as referências na interface (DOM).
 * Limpa instâncias anteriores do formulário e reconstroi programaticamente as grades dinâmicas de SKUs e Grupos.
 * @param {string} id - ID único do produto alvo de modificação
 */
async function editProduct(id) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      credentials: "include",
    });
    if (!response.ok)
      throw new Error("Não foi possível recuperar os dados do produto.");

    const p = await response.json();

    openModal();
    const form = document.getElementById("product-form");
    form.reset();

    document.getElementById("prod-id").value = p.id || p._id;
    document.getElementById("modal-title").innerText = "Editar Produto";
    document.getElementById("prod-name").value = p.name;
    document.getElementById("prod-description").value = p.description;
    document.getElementById("prod-base-price").value = p.basePrice;
    document.getElementById("prod-cat-id").value = p.categoryId;
    document.getElementById("prod-image").value = p.images?.[0] || "";
    document.getElementById("avail-start").value =
      p.availability?.start || "00:00";
    document.getElementById("avail-end").value = p.availability?.end || "23:59";

    const skuContainer = document.getElementById("skus-container");
    skuContainer.innerHTML = "";

    p.skus.forEach((sku) => {
      if (typeof addSkuRow === "function") {
        addSkuRow();
        const lastRow = skuContainer.lastElementChild;
        lastRow.querySelector(".sku-name").value = sku.name;
        lastRow.querySelector(".sku-price").value = sku.price;
        lastRow.querySelector(".sku-stock").value = sku.stock;

        const attrList = lastRow.querySelector(".attributes-list");
        attrList.innerHTML = "";
        Object.entries(sku.attributes || {}).forEach(([key, val]) => {
          const div = document.createElement("div");
          div.className = "flex gap-2 attr-pair";
          div.innerHTML = `
              <input type="text" value="${key}" class="attr-key w-1/2 p-1 border rounded text-xs">
              <input type="text" value="${val}" class="attr-val w-1/2 p-1 border rounded text-xs">
          `;
          attrList.appendChild(div);
        });
      }
    });

    const modContainer = document.getElementById("modifiers-container");
    modContainer.innerHTML = "";

    (p.modifiers || []).forEach((group) => {
      if (typeof addGroup === "function") {
        addGroup();
        const lastGroup = modContainer.lastElementChild;
        const groupId = lastGroup.dataset.id;

        lastGroup.querySelector(".group-name").value = group.name;
        lastGroup.querySelector(".group-min").value = group.min;
        lastGroup.querySelector(".group-max").value = group.max;

        group.items.forEach((item) => {
          if (typeof addItemToGroup === "function") {
            addItemToGroup(groupId);
            const lastItem =
              lastGroup.querySelector(".items-list").lastElementChild;
            lastItem.querySelector(".item-name").value = item.name;
            lastItem.querySelector(".item-price").value = item.price;
            lastItem.querySelector(".item-status").value = item.status;

            // 💡 Preenche o campo oculto ou data-attribute do ID do subitem se ele existir na tela
            if (lastItem.querySelector(".item-id")) {
              lastItem.querySelector(".item-id").value = item.id || "";
            } else {
              lastItem.dataset.id = item.id || "";
            }
          }
        });
      }
    });
  } catch (err) {
    console.error("Erro na carga de edição:", err);
    Swal.fire({
      icon: "error",
      title: "Falha ao carregar dados",
      text: err.message,
      confirmButtonColor: "#dc2626",
    });
  }
}

/**
 * ============================================================================
 * 🔄 MÓDULO DE INTERAÇÕES E REQUISIÇÕES (MUTATIONS)
 * ============================================================================
 */

/**
 * Remove em definitivo um produto da base de dados através de uma requisição DELETE HTTP.
 * Exibe uma caixa de diálogo de confirmação (SweetAlert2) com comportamento destrutivo assíncrono
 * e revalida a listagem do grid caso a operação seja confirmada pelo operador.
 * @param {string} id - ID corporativo/comercial do produto alvo de exclusão
 */
async function deleteProduct(id) {
  const resultado = await Swal.fire({
    title: "Tem certeza?",
    text: `Deseja mesmo remover o item ${id}? Esta ação não pode ser desfeita.`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Sim, remover!",
    cancelButtonText: "Cancelar",
  });

  if (!resultado.isConfirmed) return;

  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Erro desconhecido ao deletar o produto.");
    }

    Toast.fire({
      icon: "success",
      title: data.message || "Produto removido com sucesso!",
    });

    if (typeof loadProducts === "function") loadProducts();
  } catch (err) {
    console.error("Erro completo na exclusão:", err);
    Swal.fire({
      icon: "error",
      title: "Erro na exclusão",
      text: err.message,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Fechar",
    });
  }
}

/**
 * ============================================================================
 * 🖥️ MÓDULO DE INTERFACE VISUAL (DOM & FLUXO DE TELAS)
 * ============================================================================
 */

/**
 * Inicializa a exibição da camada de overlay (Modal) voltada ao cadastro de novos produtos.
 * Purga chaves identitárias residuais e referências de subformulários dinâmicos de SKUs ou
 * Modificadores para evitar vazamento ou persistência cruzada de dados.
 */
function openModal() {
  document.getElementById("prod-id").value = ""; // MUITO IMPORTANTE
  document.getElementById("modal-title").innerText = "Cadastrar Produto";
  document.getElementById("product-form").reset();

  // Limpa containers dinâmicos para não acumular lixo de edições anteriores
  document.getElementById("skus-container").innerHTML = "";
  document.getElementById("modifiers-container").innerHTML = "";

  // Adiciona uma linha em branco por padrão
  addSkuRow();

  document.getElementById("product-modal").classList.remove("hidden");
}

/**
 * Esconde o modal de produtos do viewport, executa o reset nativo dos elementos de formulário
 * e limpa chaves de ancoragem ocultas para assegurar a integridade visual e funcional na próxima invocação.
 */
function closeModal() {
  // 1. Esconde o modal
  const modal = document.getElementById("product-modal");
  modal.classList.add("hidden");

  // 2. Limpa o formulário (reseta inputs de texto, checkbox, etc)
  const form = document.getElementById("product-form");
  form.reset();

  // 3. Limpa o ID oculto para que o próximo "Salvar" não tente editar o item anterior
  const idInput = document.getElementById("prod-id");
  if (idInput) {
    idInput.value = "";
  }

  // 4. (Opcional) Limpa os containers dinâmicos para evitar "lixo" visual na próxima abertura
  document.getElementById("skus-container").innerHTML = "";
  document.getElementById("modifiers-container").innerHTML = "";

  // Reseta o título do modal para o padrão
  const title = document.getElementById("modal-title");
  if (title) {
    title.innerText = "Cadastrar Produto";
  }
}

/**
 * ============================================================================
 * 📋 MÓDULO DE GESTÃO DE PEDIDOS (OMS INTEGRATION)
 * ============================================================================
 */

/**
 * Consome os dados de pedidos da API remota.
 * Sincroniza o ecossistema chamando a revalidação do badge e a montagem das ordens.
 */
async function loadOrders() {
  try {
    const res = await fetch(`https://prafoodapi.onrender.com/pedidos`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const orders = await res.json();
    updateOrdersBadge(orders);
    renderOrders(orders);
  } catch (err) {
    console.error("Erro ao carregar pedidos:", err);
  }
}

/**
 * Atualiza dinamicamente o número indicador de novos pedidos no painel lateral de navegação.
 * Extrai, normaliza e avalia arrays aninhados baseados em strings de status padronizadas.
 * @param {Array|Object} orders - Resposta bruta de pedidos enviada pelo servidor
 */
function updateOrdersBadge(orders) {
  const badge = document.getElementById("badge-orders-count");

  // 🚨 ALERT 1: Verifica se o elemento HTML existe
  if (!badge) {
    return;
  }

  // Normalização
  let listaPedidos = Array.isArray(orders)
    ? orders
    : orders?.data || orders?.pedidos || [];

  if (listaPedidos.length === 0) {
    badge.classList.add("hidden");
    return;
  }

  // Captura um exemplo do status do primeiro pedido para sabermos como ele está escrito no banco
  const exemploStatus = listaPedidos[0]?.status || "SEM STATUS RECONHECIDO";

  // Filtro
  const qtdPendentes = listaPedidos.filter((order) => {
    const statusAtual = order.status ? order.status.toUpperCase().trim() : "";
    return statusAtual === "CREATED" || statusAtual === "PENDING";
  }).length;

  // Atualização visual
  if (qtdPendentes > 0) {
    badge.innerText = qtdPendentes;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

/**
 * ============================================================================
 * 📋 MÓDULO DE GESTÃO DE PEDIDOS (OMS - ORDER MANAGEMENT SYSTEM)
 * ============================================================================
 */

/**
 * Renderiza os cartões (cards) de pedidos no painel de controle operacional.
 * Insere metadados estruturais como `data-status` e `data-type` para dar suporte
 * a filtros dinâmicos no front-end, mapeia as cores por status e injeta modificadores de itens.
 * @param {Array} orders - Lista de objetos de pedidos retornada pelo servidor
 */
function renderOrders(orders) {
  const container = document.getElementById("orders-container");

  if (!orders || orders.length === 0) {
    container.innerHTML =
      '<p class="p-4 text-gray-500 text-center">Nenhum pedido encontrado.</p>';
    return;
  }

  container.innerHTML = orders
    .map((order) => {
      const displayId = order.id || order._id;
      const databaseId = order._id || order.id;
      const dataPedido = order.createdAt
        ? new Date(order.createdAt).toLocaleTimeString()
        : "00:00";
      const total = order.pagamento?.total || 0;

      // Pegamos o tipo de entrega (DELIVERY ou TAKEOUT)
      const tipoEntrega = order.entrega?.tipo || "DELIVERY";

      const statusColors = {
        CREATED: "border-yellow-400",
        PREPARING: "border-blue-500",
        READY: "border-purple-500",
        ON_THE_WAY: "border-orange-500",
        DELIVERED: "border-green-500",
        CANCELED: "border-red-600",
      };

      // MUDANÇA: Adicionamos data-status e data-type no container principal
      return `
        <div data-status="${order.status}" data-type="${tipoEntrega}" class="bg-white p-6 rounded-xl shadow-sm border-l-8 ${statusColors[order.status] || "border-gray-200"}">
            <div class="flex justify-between mb-4">
                <span class="font-bold text-lg text-gray-800">${displayId}</span>
                <span class="text-sm text-gray-500">${dataPedido}</span>
            </div>
            
            <div class="mb-4">
                <p class="font-bold">${order.cliente?.nome || "Cliente"}</p>
                <p class="text-xs text-gray-500 uppercase">${tipoEntrega}</p>
            </div>

            <div class="border-t border-b py-2 mb-4">
                ${
                  order.itens
                    ? order.itens
                        .map(
                          (i) => `
                    <div class="text-sm">${i.quantity || 1}x ${i.name || i.nome}</div>
                `,
                        )
                        .join("")
                    : ""
                }
            </div>

            <div class="flex justify-between items-center">
                <span class="font-bold text-red-600 text-xl">R$ ${Number(total).toFixed(2)}</span>
                <div class="flex gap-2">
                    <button onclick="printOrder('${displayId}')" class="bg-gray-100 p-2 rounded hover:bg-gray-200">
                        🖨️
                    </button>
                    <select onchange="updateOrderStatus('${databaseId}', this.value)" class="text-sm border rounded p-1">
                        <option value="CREATED" ${order.status === "CREATED" ? "selected" : ""}>Pendente</option>
                        <option value="PREPARING" ${order.status === "PREPARING" ? "selected" : ""}>Preparando</option>
                        <option value="READY" ${order.status === "READY" ? "selected" : ""}>Pronto</option>
                        <option value="OUT_FOR_DELIVERY" ${order.status === "OUT_FOR_DELIVERY" ? "selected" : ""}>Em rota</option>
                        <option value="DELIVERED" ${order.status === "DELIVERED" ? "selected" : ""}>Entregue</option>
                         <option value="CANCELED" ${order.status === "CANCELED" ? "selected" : ""}>Cancelar</option>
                    </select>
                </div>
            </div>
        </div>
    `;
    })
    .join("");
}

/**
 * Transiciona o estado de um pedido específico no back-end.
 * Bloqueia a concorrência visual através de telas de carregamento do SweetAlert2, intercepta transições
 * de prontidão (`READY`) para disparar a baixa de inventário e expõe opções para o envio de mensagens transacionais.
 * @param {string} orderId - ID único persistido na base de dados (MongoDB _id ou equivalente)
 * @param {string} newStatus - Alvo de transição do pedido (ex: "PREPARING", "READY")
 */
async function updateOrderStatus(orderId, newStatus) {
  Swal.fire({
    title: "Atualizando status...",
    didOpen: () => Swal.showLoading(),
    allowOutsideClick: false,
  });

  try {
    const response = await fetch(
      `https://prafoodapi.onrender.com/pedidos/${orderId}/status`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Erro na transição de status");
    }

    const pedidoAtualizado = result.data;

    // LÓGICA DE VENDA AUTOMÁTICA
    if (newStatus === "READY") {
      await processarVendasDoPedido(pedidoAtualizado);
    }

    // Injetamos o novo status manualmente para a mensagem
    pedidoAtualizado.status = newStatus;

    // --- SUCESSO UNIFICADO ---
    Swal.fire({
      icon: "success",
      title: "Status Atualizado!",
      text: `O pedido ${pedidoAtualizado.id || ""} agora está como ${newStatus}.`,
      showCancelButton: true,
      confirmButtonText: "📱 Avisar no WhatsApp",
      cancelButtonText: "Fechar",
      confirmButtonColor: "#25D366", // Verde WhatsApp
      cancelButtonColor: "#6e7881",
      allowOutsideClick: false,
    }).then((resultSwal) => {
      if (resultSwal.isConfirmed) {
        enviarNotificacaoWhatsApp(pedidoAtualizado);
      }
    });

    if (typeof loadOrders === "function") loadOrders();
  } catch (err) {
    console.error("[STATUS_UPDATE_ERROR]:", err);
    Swal.fire({
      icon: "error",
      title: "Falha na operação",
      text: err.message,
    });
  }
}

/**
 * Constrói e direciona templates de mensagens transacionais customizadas para a API pública do WhatsApp.
 * Realiza a higienização de caracteres não numéricos nas strings telefônicas e codifica componentes de URI.
 * @param {Object} pedido - Objeto de dados contendo o estado atualizado da ordem
 */
function enviarNotificacaoWhatsApp(pedido) {
  // Acessando os dados conforme a estrutura do seu objeto
  const cliente = pedido.cliente || {};
  const celular = cliente.telefone ? cliente.telefone.replace(/\D/g, "") : "";
  const nome = cliente.nome || "Cliente";
  const idPedido = pedido.id || pedido._id; // Usa o ID formatado ou o do MongoDB
  const statusAtual = pedido.status; // O status que você acabou de atualizar

  const mensagens = {
    CONFIRMED: `Olá ${nome}! Seu pedido ${idPedido} foi confirmado e já vai entrar em produção. 👍`,
    PREPARING: `Olá ${nome}! Seu pedido ${idPedido} já está sendo preparado com todo carinho. 👨‍🍳`,
    READY: `Olá ${nome}! Boas notícias: seu pedido ${idPedido} está pronto para retirada! 🥳`,
    ON_THE_WAY: `Olá ${nome}! Seu pedido ${idPedido} acabou de sair para entrega. Prepare a mesa! 🛵`,
    DELIVERED: `Olá ${nome}! Seu pedido ${idPedido} foi entregue. Bom apetite! 😋`,
    CANCELED: `Olá ${nome}, o seu pedido ${idPedido} foi cancelado. Se tiver dúvidas, entre em contato conosco.`,
    default: `Olá ${nome}! O status do seu pedido ${idPedido} foi atualizado para: ${statusAtual}.`,
  };

  const texto = mensagens[statusAtual] || mensagens["default"];

  // O link utiliza o código do país (55) + o telefone limpo
  const url = `https://api.whatsapp.com/send?phone=55${celular}&text=${encodeURIComponent(texto)}`;

  if (celular) {
    window.open(url, "_blank");
  } else {
    console.error("Erro: Cliente sem telefone cadastrado.");
  }
}

/**
 * ============================================================================
 * 📦 MÓDULO DE LOGÍSTICA E CONTROLE DE INVENTÁRIO (INVENTORY ENGINE)
 * ============================================================================
 */

/**
 * Gerencia o abatimento reativo de estoque na base de dados através de chamadas concorrentes.
 * Trata de forma segmentada caminhos de execução independentes para produtos convencionais baseados em SKUs
 * de tamanho e agrupamentos lógicos da categoria "Combos" com extração em profundidade de subprodutos.
 * @param {Object} pedido - Payload completo do pedido cujos itens sofrerão dedução de estoque
 */
async function processarVendasDoPedido(pedido) {
  if (!pedido.itens || pedido.itens.length === 0) return;

  const promessasVendas = pedido.itens.map(async (itemPedido) => {
    try {
      // 1. Busca o produto completo para encontrar os SKUs
      const resProduto = await fetch(`${API_URL}/${itemPedido.productId}`, {
        credentials: "include",
      });

      if (!resProduto.ok)
        throw new Error(`Produto ${itemPedido.productId} não encontrado.`);

      const produtoFull = await resProduto.json();
      const dadosProduto = produtoFull.data || produtoFull; // Ajuste conforme sua API retorna

      // VEJA AQUI: Verifica se o produto pertence à categoria "Combos"
      const isCombo = dadosProduto.categoryId === "Combos";

      if (isCombo) {
        console.log(`📦 Processando combo: ${dadosProduto.name}`);

        // 1. Acessa o modificador diretamente da raiz do produto
        const modificadorItens = dadosProduto.modifiers?.find(
          (m) => m.name.toLowerCase().trim() === "itens inclusos no combo",
        );

        if (
          !modificadorItens ||
          !modificadorItens.items ||
          modificadorItens.items.length === 0
        ) {
          console.error("DEBUG - Produto completo recebido:", dadosProduto);
          throw new Error(
            `O combo "${dadosProduto.name}" não possui itens válidos na raiz de modifiers.`,
          );
        }

        // 2. Mapeia e dispara o abatimento de estoque para cada subitem
        const promessasItensCombo = modificadorItens.items.map(
          async (subItem) => {
            // 🔍 PASSO CHAVE: Busca o produto original (ex: Sprite) para descobrir o SKU real dele
            const resProdutoReal = await fetch(`${API_URL}/${subItem.id}`, {
              credentials: "include",
            });

            if (!resProdutoReal.ok) {
              throw new Error(
                `Produto ingrediente [${subItem.name}] não foi encontrado no sistema.`,
              );
            }

            const produtoRealFull = await resProdutoReal.json();
            const dadosProdutoReal = produtoRealFull.data || produtoRealFull;

            // Pega o primeiro SKU disponível do produto (Refrigerantes/Sopas em combo geralmente usam o SKU único)
            const skuReal = dadosProdutoReal.skus?.[0];

            if (!skuReal || !skuReal._id) {
              throw new Error(
                `O produto [${subItem.name}] não possui um SKU válido configurado.`,
              );
            }

            // 🚀 AGORA SIM: Faz o POST enviando o _id do SKU REAL do produto!
            const resVendaSubItem = await fetch(
              `${API_URL}/${subItem.id}/sell`,
              {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  productId: subItem.id, // ID comercial do produto ("PROD-177...")
                  skuId: skuReal._id, // 💡 O _id real do SKU recuperado do banco (ex: "69ff2982...")
                  quantity: parseInt(itemPedido.quantity),
                }),
              },
            );

            if (!resVendaSubItem.ok) {
              const errorData = await resVendaSubItem.json();
              throw new Error(
                `Erro no subitem [${subItem.name}]: ${errorData.message || "Erro ao abater estoque"}`,
              );
            }
          },
        );

        // Aguarda o estoque de todos os subitens ser baixado com sucesso
        await Promise.all(promessasItensCombo);
        return `Sucesso Combo: ${itemPedido.name}`;
      } else {
        // 2. Localiza o SKU que corresponde ao tamanho do pedido
        // Compara "media" do pedido com "media" do cadastro do produto
        const skuCorrespondente = dadosProduto.skus.find(
          (sku) => sku.name.toLowerCase() === itemPedido.size.toLowerCase(),
        );

        if (!skuCorrespondente) {
          throw new Error(
            `Tamanho "${itemPedido.size}" não encontrado no cadastro do produto.`,
          );
        }

        // 3. Agora sim, faz a venda usando o ID real do SKU
        const resVenda = await fetch(
          `${API_URL}/${itemPedido.productId}/sell`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: itemPedido.productId,
              skuId: skuCorrespondente._id, // O ID real: "SKU-177..."
              quantity: parseInt(itemPedido.quantity),
            }),
          },
        );

        if (!resVenda.ok) {
          const errorData = await resVenda.json();
          throw new Error(errorData.message || "Erro ao abater estoque");
        }

        return `Sucesso: ${itemPedido.name}`;
      }
    } catch (err) {
      console.error(`[ERRO_ITEM]: ${itemPedido.name}`, err.message);
      throw err; // Repassa para o Promise.all interromper ou logar
    }
  });

  try {
    await Promise.all(promessasVendas);
    console.log("✅ Todos os itens foram processados com sucesso.");
  } catch (err) {
    // Lança o erro para ser capturado pelo Swal na função principal (updateOrderStatus)
    throw new Error(`Erro no processamento de estoque: ${err.message}`);
  }
}

/**
 * ============================================================================
 * 🖨️ MÓDULO DE IMPRESSÃO (PERIPHERAL INTEGRATION)
 * ============================================================================
 */

/**
 * Encaminha o identificador de um pedido para a rota de impressão térmica/física do servidor.
 * Altera o estado do SweetAlert2 para um carregamento bloqueado e emite o feedback do resultado.
 * @param {string} id - ID de exibição ou corporativo do pedido
 */
async function printOrder(id) {
  // Show a "Loading" state so the user knows something is happening
  Toast.fire({
    title: "Processando...",
    text: "Enviando pedido para a impressora",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });

  try {
    const response = await fetch("https://prafoodapi.onrender.com/pedidos/imprimir", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pedidoId: id }),
    });

    const result = await response.json();

    if (response.ok) {
      // Success Alert
      Toast.fire({
        icon: "success",
        title: "Sucesso!",
        text: result.message || "Pedido enviado para a impressora.",
        timer: 3000,
        showConfirmButton: false,
      });
    } else {
      // Server-side Error
      Toast.fire({
        icon: "error",
        title: "Erro na Impressão",
        text: result.error || "Não foi possível imprimir o pedido.",
      });
    }
  } catch (err) {
    // Network or Runtime Error
    Toast.fire({
      icon: "error",
      title: "Ops!",
      text: "Falha na conexão com o servidor.",
    });
  }
}

/**
 * ============================================================================
 * 📊 MÓDULO ANALÍTICO & INTELIGÊNCIA DE NEGÓCIOS (BI)
 * ============================================================================
 */

let myCharts = {}; // Dicionário global para cache e gerenciamento de concorrência de instâncias do Chart.js

/**
 * Calcula os principais KPIs financeiros da operação e consolida as métricas agrupadas.
 * Alimenta dinamicamente os contêineres de texto e delega a renderização gráfica dos dados agregados.
 * @param {Array} orders - Coleção de pedidos filtrada ou completa
 */
function renderDashboard(orders) {
  // Defina quais status representam uma venda concluída com sucesso
  const statusConcluidos = ["DELIVERED", "DELIVERED"];

  const completedOrders = orders.filter((o) =>
    statusConcluidos.includes(o.status),
  );
  // 1. Cálculos de KPIs
  const totalSales = completedOrders.reduce(
    (acc, curr) => acc + (curr.pagamento?.total || 0),
    0,
  );

  const totalOrders = orders.length;
  const totalOrdersCompleted = completedOrders.length;
  const ticketMedio =
    totalOrdersCompleted > 0 ? totalSales / totalOrdersCompleted : 0;

  document.getElementById("kpi-vendas").innerText =
    `R$ ${totalSales.toFixed(2)}`;
  document.getElementById("kpi-pedidos").innerText = totalOrders;
  document.getElementById("kpi-ticket").innerText =
    `R$ ${ticketMedio.toFixed(2)}`;

  // 2. Processamento para Gráfico de Status
  const statusCount = {};
  orders.forEach(
    (o) => (statusCount[o.status] = (statusCount[o.status] || 0) + 1),
  );

  // 3. Processamento para Gráfico de Pagamentos
  const paymentCount = {};
  orders.forEach((o) => {
    const method = o.pagamento?.metodo || "Outros";
    paymentCount[method] = (paymentCount[method] || 0) + 1;
  });

  // Renderizar Gráficos
  updateChart(
    "chartStatus",
    Object.keys(statusCount),
    Object.values(statusCount),
    "Pedidos por Status",
    "doughnut",
  );
  updateChart(
    "chartPayments",
    Object.keys(paymentCount),
    Object.values(paymentCount),
    "Pagamentos",
    "bar",
  );
}

/**
 * Controlador abstrato para renderização de instâncias do Chart.js.
 * Implementa de forma transparente o ciclo de destruição (`.destroy()`) de instâncias antigas
 * para prevenir vazamentos de memória e falhas de sobreposição gráfica no Canvas HTML5.
 */
function updateChart(canvasId, labels, data, label, type) {
  if (myCharts[canvasId]) myCharts[canvasId].destroy(); // Destroi o gráfico anterior antes de criar novo

  const ctx = document.getElementById(canvasId).getContext("2d");
  myCharts[canvasId] = new Chart(ctx, {
    type: type,
    data: {
      labels: labels,
      datasets: [
        {
          label: label,
          data: data,
          backgroundColor: [
            "#ea1d2c",
            "#3b82f6",
            "#10b981",
            "#f59e0b",
            "#6366f1",
            "#ef4444",
          ],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
    },
  });
}

let allOrdersData = []; // Variável global para guardar os pedidos sem precisar ir no banco toda hora

/**
 * Consome o histórico totalizador de ordens emitidas e inicializa a pipeline de filtros.
 */
async function loadDashboardData() {
  try {
    const res = await fetch("https://prafoodapi.onrender.com/pedidos", {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
    allOrdersData = await res.json();
    applyDashFilters(); // Aplica o filtro inicial
  } catch (err) {
    console.error("Erro ao carregar dados do dashboard:", err);
  }
}

/**
 * Filtra programaticamente o cache global de ordens cruzando dados cronológicos e de negócios.
 * Trata desvios em milissegundos e atualiza a renderização de forma reativa.
 */
function applyDashFilters() {
  const period = document.getElementById("dash-filter-period").value;
  const payment = document.getElementById("dash-filter-payment").value;

  const now = new Date();

  let filtered = allOrdersData.filter((order) => {
    const orderDate = new Date(order.createdAt);
    const diffTime = Math.abs(now - orderDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // 1. Filtro de Tempo
    let timeMatch = true;
    if (period === "today")
      timeMatch = orderDate.toDateString() === now.toDateString();
    else if (period === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      timeMatch = orderDate.toDateString() === yesterday.toDateString();
    } else if (period === "7days") timeMatch = diffDays <= 7;
    else if (period === "30days") timeMatch = diffDays <= 30;

    // 2. Filtro de Pagamento
    let paymentMatch = payment === "all" || order.pagamento?.metodo === payment;

    return timeMatch && paymentMatch;
  });

  renderDashboard(filtered); // Chama a função que desenha os gráficos com os dados filtrados
}

/**
 * ============================================================================
 * 📡 MOTOR DE COMUNICAÇÃO EM TEMPO REAL (REAL-TIME POLLING ENGINE)
 * ============================================================================
 */

// 🎵 Descobre a pasta atual onde o index.html está rodando e anexa o arquivo de som
const urlAtual = window.location.href.substring(
  0,
  window.location.href.lastIndexOf("/"),
);
const audioAlerta = new Audio(urlAtual + "/alarm.mp3");
audioAlerta.load();

// 🔓 Função para liberar o som no primeiro clique do operador
const liberarSomProducao = () => {
  audioAlerta
    .play()
    .then(() => {
      audioAlerta.pause();
      audioAlerta.currentTime = 0;
      document.removeEventListener("click", liberarSomProducao);
      document.removeEventListener("touchstart", liberarSomProducao);
      console.log("🔊 Áudio de produção liberado com sucesso!");
    })
    .catch((e) => console.log("Aguardando clique para liberar áudio...", e));
};

document.addEventListener("click", liberarSomProducao);
document.addEventListener("touchstart", liberarSomProducao);

let primeiraBusca = true;

setInterval(async () => {
  try {
    if (primeiraBusca) {
      console.log("🔍 Monitoramento de pedidos ativos (A cada 45s)...");
      primeiraBusca = false;
    }

    const res = await fetch("https://prafoodapi.onrender.com/pedidos/pendentes", {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) return;

    const novosPedidos = await res.json();

    if (novosPedidos && novosPedidos.length > 0) {
      // 🔊 Toca o som local
      audioAlerta.currentTime = 0;

      const playPromise = audioAlerta.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.error(
            "⚠️ O navegador barrou o som. Dê um clique na tela.",
            err.message,
          );
        });
      }

      // Notificação elegante (Toast)
      if (typeof Toast !== "undefined") {
        Toast.fire({
          icon: "success",
          title: `${novosPedidos.length} novo(s) pedido(s) recebido(s)!`,
          text: "Enviando para a impressora...",
        });
      }

      // Atualiza a tela de pedidos
      const sectionOrders = document.getElementById("section-orders");
      if (sectionOrders && !sectionOrders.classList.contains("hidden")) {
        if (typeof loadOrders === "function") {
          loadOrders();
        }
      }
    }
  } catch (err) {
    console.error("❌ Erro no monitor:", err);
  }
}, 45000); // ⏱️ Monitorando a cada 45 segundos

/**
 * ============================================================================
 * 🔍 CONTROLADORES DE FILTRO DE INTERFACE (UI FILTERS)
 * ============================================================================
 */

/**
 * Filtra em tempo real as linhas do DOM na tabela de gerenciamento do cardápio.
 * Avalia de forma cruzada correspondências parciais por string (busca), chaves idênticas (categoria)
 * e o metadado customizado de disponibilidade (`data-status`).
 */
function filterMenu() {
  const searchTerm = document
    .getElementById("filter-menu-search")
    .value.toLowerCase();
  const catFilter = document
    .getElementById("filter-menu-cat")
    .value.toLowerCase();
  const statusFilter = document.getElementById("filter-menu-status").value;

  const rows = document.querySelectorAll("#product-list tr");

  rows.forEach((row) => {
    const name = row.cells[0].innerText.toLowerCase();
    const category = row.cells[1].innerText.toLowerCase();

    // MUDANÇA AQUI: Pegamos o valor do atributo 'data-status' que injetaremos na TD
    const statusValue = row.cells[3].getAttribute("data-status");

    const matchesSearch = name.includes(searchTerm);
    const matchesCat = catFilter === "all" || category.includes(catFilter);
    const matchesStatus =
      statusFilter === "all" || statusValue === statusFilter;

    // Aplica a visibilidade
    row.style.display =
      matchesSearch && matchesCat && matchesStatus ? "" : "none";
  });
}

/**
 * ============================================================================
 * 🔍 CONTROLADORES DE FILTRO DE INTERFACE (UI FILTERS)
 * ============================================================================
 */

/**
 * Filtra em tempo real os cartões (cards) de pedidos exibidos no painel operacional.
 * Avalia de forma cruzada correspondências parciais por string (busca) e os metadados
 * estruturais de estado injetados no escopo do elemento (`data-status` e `data-type`).
 */
function filterOrders() {
  const searchTerm = document
    .getElementById("filter-order-search")
    .value.toLowerCase();
  const statusFilter = document.getElementById("filter-order-status").value;
  const typeFilter = document.getElementById("filter-order-type").value;

  const orders = document.querySelectorAll("#orders-container > div"); // Seleciona os cards de pedidos

  orders.forEach((order) => {
    // Aqui assume-se que você guarda o status/tipo em atributos 'data-' ou classes
    const text = order.innerText.toLowerCase();
    const orderStatus = order.getAttribute("data-status");
    const orderType = order.getAttribute("data-type");

    const matchesSearch = text.includes(searchTerm);
    const matchesStatus =
      statusFilter === "all" || orderStatus === statusFilter;
    const matchesType = typeFilter === "all" || orderType === typeFilter;

    order.style.display =
      matchesSearch && matchesStatus && matchesType ? "block" : "none";
  });
}

/**
 * ============================================================================
 * 📦 MÓDULO DE LOGÍSTICA E CONTROLE DE INVENTÁRIO (INVENTORY ENGINE)
 * ============================================================================
 */

/**
 * Registra entradas ou baixas pontuais de estoque para um SKU específico via prompt interativo.
 * Bloqueia a concorrência visual durante as transações HTTP POST e revalida o catálogo local.
 * @param {string} productId - ID comercial/pai do produto alvo
 * @param {string} skuId - Identificador único do SKU persistido no banco (_id)
 * @param {string} type - Tipo de mutação logística desejada ("add" ou "sell")
 */
async function handleStock(productId, skuId, type) {
  const isAdd = type === "add";

  const { value: quantity } = await Swal.fire({
    title: isAdd ? "Entrada de Estoque" : "Registrar Venda",
    input: "number", // Mudado para number para facilitar no celular/teclado
    inputLabel: `Quantidade para ${isAdd ? "adicionar" : "remover"}`,
    inputPlaceholder: "Ex: 10",
    showCancelButton: true,
    confirmButtonText: "Confirmar",
    cancelButtonText: "Cancelar",
    inputValidator: (value) => {
      if (!value || isNaN(value) || parseInt(value) <= 0) {
        return "Insira uma quantidade válida e maior que zero!";
      }
    },
  });

  if (quantity) {
    Swal.fire({
      title: "Processando...",
      didOpen: () => Swal.showLoading(),
      allowOutsideClick: false,
    });

    try {
      // O endpoint pode continuar usando o productId na URL
      const endpoint = isAdd ? `/${productId}/addstock` : `/${productId}/sell`;

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          skuId, // 🔥 ENVIANDO O SKU CORRETO (Média ou Grande)
          quantity: parseInt(quantity),
        }),
      });

      let result;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        result = await res.json();
      }

      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "Sucesso!",
          text: result?.message || "Operação realizada com sucesso.",
          timer: 2000,
          showConfirmButton: false,
        });
        loadProducts();
      } else {
        // Aqui o Swal vai mostrar exatamente o "throw new Error" do seu backend
        // Ex: "Estoque insuficiente para Grande"
        const errorMsg =
          result?.error || result?.message || "Erro no servidor.";
        throw new Error(errorMsg);
      }
    } catch (err) {
      console.error("Erro detalhado:", err);

      Swal.fire({
        icon: "error",
        title: "Ação interrompida",
        text: err.message,
        confirmButtonColor: "#d33",
      });
    }
  }
}

/**
 * ============================================================================
 * 🔄 MÓDULO DE SESSÃO E CONTROLE DE ACESSO (AUTHENTICATION)
 * ============================================================================
 */

/**
 * Restaura de forma assíncrona o estado de sessão do usuário no carregamento inicial da página.
 * Valida permissões corporativas através de tokens de identificação persistidos em cookies seguros.
 */
async function restaurarSessao() {
  try {
    // 1. Tenta buscar o usuário (o cookie vai automático via credentials)
    await fetchUserData();

    // 2. Se chegamos aqui, o login foi bem sucedido via cookie
    if (currentUser && currentUser.role === "ADMIN") {
      // Esconde login e mostra o App
      document.getElementById("login-screen").classList.add("hidden");
      document.getElementById("main-app").classList.remove("hidden");

      // 3. Recupera a última aba salva no F5 (ou padrão 'menu')
      const ultimaAba = localStorage.getItem("admin_last_section") || "menu";
      toggleSection(ultimaAba);

      // 4. Inicia o monitor de pedidos se ele existir
      if (typeof monitorarNovosPedidos === "function") {
        setInterval(monitorarNovosPedidos, 5000);
      }
    } else if (currentUser) {
      // Se for cliente, mostra a tela de menu do cliente
      showMenu();
    }
  } catch (err) {
    // Se der erro (ex: cookie expirou), mostra a tela de login
    console.log("Sem sessão ativa. Aguardando login.");
    document.getElementById("login-screen").classList.remove("hidden");
  }
}

// Executa a restauração assim que o script carregar
restaurarSessao();

/**
 * Gerencia o roteamento de telas da área administrativa (SPA behavior).
 * Modifica as classes de layout do Tailwind CSS e persiste o estado da aba ativa no LocalStorage.
 * @param {string} section - Identificador da seção destino (ex: "menu", "orders", "dashboard")
 */
async function toggleSection(section) {
  // 🔥 NOVO: Salva a seção atual para não perder no F5
  localStorage.setItem("admin_last_section", section);

  const sections = ["menu", "orders", "dashboard", "tables"];

  sections.forEach((s) => {
    const el = document.getElementById(`section-${s}`);
    const nav = document.getElementById(`nav-${s}`);
    if (el) el.classList.toggle("hidden", s !== section);

    if (nav) {
      nav.className =
        s === section
          ? "block font-bold text-red-600 border-l-4 border-red-600 pl-3 bg-red-50 py-2"
          : "block text-gray-500 hover:text-red-500 pl-4 transition py-2";
    }
  });

  // Gatilhos de carregamento de dados
  if (section === "menu") loadProducts();
  if (section === "orders") loadOrders();
  if (section === "tables") initTables();
  if (section === "dashboard") {
    loadDashboardData();
    try {
      const res = await fetch(`https://prafoodapi.onrender.com/pedidos`, {
        method: "GET",
        credentials: "include",
      });
      const orders = await res.json();
      renderDashboard(orders);
    } catch (e) {
      console.error("Erro dashboard:", e);
    }
  }
}

/**
 * ============================================================================
 * 🍽️ MÓDULO DE CONTROLE DE COMANDAS (TABLES MANAGEMENT SYSTEM)
 * ============================================================================
 */
let selectedTable = null;
let tablesData = {}; // { 1: [itens], 2: [] ... }

// Escudos para evitar erros de funções do cliente que não existem no Admin
let currentProduct = null;
function switchTab(tab) {
  console.log("Troca de aba ignorada no Admin");
}
function updateTotal() {
  console.log("Total atualizado");
}

/**
 * Sincroniza o mapa de comandas consumindo os dados persistidos no MongoDB via API.
 * Implementa rotinas de backup baseadas no LocalStorage do navegador para garantir resiliência offline.
 */
async function initTables() {
  // Pega o ID da empresa (certifique-se que storeTag está disponível globalmente)
  const companyId = typeof storeTag !== "undefined" ? storeTag : "ADMIN-LOCAL";

  try {
    // Busca o estado atual no servidor
    const res = await fetch(
      `https://prafoodapi.onrender.com/products/tables/status/${companyId}`,
      {
        method: "GET", // Método padrão, mas deixamos explícito
        credentials: "include", // <--- ESSENCIAL: Envia os cookies/sessão para a API
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    const result = await res.json();

    if (res.ok && result.tables) {
      // Se encontrou no banco, carrega
      tablesData = result.tables;
    } else {
      // Se não houver no banco, tenta o backup local
      const saved = localStorage.getItem("prafood_tables_data");
      if (saved) tablesData = JSON.parse(saved);
    }
  } catch (err) {
    // Substituído o console.error por alert
    Toast.fire({
  icon: "info", // Ícone azul de informação
  title: "Erro ao conectar com o servidor. O sistema funcionará em modo offline (dados locais).",
  timer: 5000 // Aumentado para 5 segundos para dar tempo do usuário ler um texto maior
});
    const saved = localStorage.getItem("prafood_tables_data");
    if (saved) tablesData = JSON.parse(saved);
  }

  // Garante que as 10 mesas existam no objeto para evitar erros de renderização
  for (let i = 1; i <= 10; i++) {
    if (!tablesData[i]) tablesData[i] = [];
  }

  renderTablesGrid();
}

/**
 * Constrói e renderiza a matriz visual indicadora das mesas no painel.
 * Aplica mutações e estados de animação baseados na ocupação ou foco ativo de gerenciamento.
 */
function renderTablesGrid() {
  const grid = document.getElementById("tables-grid");
  if (!grid) return;

  grid.innerHTML = "";
  for (let i = 1; i <= 10; i++) {
    const hasItems = tablesData[i].length > 0;
    const isActive = selectedTable === i;

    grid.innerHTML += `
            <div onclick="selectTable(${i})" 
                 class="h-20 flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all border-2 
                 ${isActive ? "border-red-600 bg-red-50 ring-2 ring-red-100" : hasItems ? "bg-amber-50 border-amber-400 animate-pulse" : "bg-white border-gray-100 hover:border-red-200"}">
                <span class="text-[10px] font-bold ${hasItems ? "text-amber-600" : "text-gray-400"}">MESA</span>
                <span class="text-2xl font-black ${hasItems ? "text-amber-700" : "text-gray-800"}">${i}</span>
                ${hasItems ? `<span class="text-[9px] font-bold text-amber-600">${tablesData[i].length} ITENS</span>` : ""}
            </div>
        `;
  }
}

/**
 * Seleciona e estabelece uma mesa ativa no espaço de trabalho lateral.
 * Invoca o barramento de carregamento do cardápio acoplado se necessário.
 * @param {number} num - Índice identificador da mesa
 */
function selectTable(num) {
  selectedTable = num;
  document.getElementById("table-workspace").classList.remove("hidden");
  document.getElementById("selected-table-badge").classList.remove("hidden");
  document.getElementById("active-table-number").innerText = num;

  renderTablesGrid();

  const tableMenuContainer = document.getElementById("table-menu-container");

  // Verifica se os produtos já foram carregados, se não, carrega antes de renderizar
  if (allProductsGlobal.length === 0) {
    loadProducts().then(() => {
      renderProductsForAdmin(allProductsGlobal, tableMenuContainer);
    });
  } else {
    renderProductsForAdmin(allProductsGlobal, tableMenuContainer);
  }

  updateTableSummary();
}

/**
 * Injeta uma grade simplificada do catálogo de produtos ativos no menu compacto lateral.
 * Realiza o escape de aspas simples nas strings JSON injetadas diretamente nos gatilhos inline do DOM.
 * @param {Array} products - Lista de produtos ativos cadastrados
 * @param {HTMLElement} container - Nó HTML de destino para montagem
 */
function renderProductsForAdmin(products, container) {
  const filtered = products.filter((p) => p.status === "ACTIVE");

  container.innerHTML = filtered
    .map(
      (p) => `
        <div class="flex justify-between items-center p-3 border rounded-xl hover:bg-gray-50 cursor-pointer shadow-sm transition-colors mb-2" 
             onclick='openProductDetailsForTable(${JSON.stringify(p).replace(/'/g, "&apos;")})'>
            <div class="flex-1 pr-2">
                <h4 class="font-bold text-gray-800 uppercase text-[10px]">${p.name}</h4>
                <p class="text-red-600 font-bold text-xs">R$ ${Number(p.basePrice || 0).toFixed(2)}</p>
            </div>
            ${p.images?.[0] ? `<img src="${p.images[0]}" class="w-10 h-10 rounded-lg object-cover">` : ""}
        </div>
    `,
    )
    .join("");
}

/**
 * Desfaz a seleção ativa de mesa e oculta as ferramentas de edição de comandas do painel lateral.
 */
function cancelTableSelection() {
  selectedTable = null;
  document.getElementById("table-workspace").classList.add("hidden");
  document.getElementById("selected-table-badge").classList.add("hidden");
  renderTablesGrid();
}

/**
 * Renderiza o catálogo geral de itens disponíveis para inclusão nas comandas.
 */
function renderTableMenu() {
  const container = document.getElementById("table-menu-container");
  // 'products' deve ser sua variável global que contém os itens do cardápio
  container.innerHTML = products
    .map(
      (p) => `
        <div onclick="openProductDetailsForTable('${p.id}')" class="flex items-center p-3 border rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
            <div class="flex-1">
                <h4 class="text-xs font-bold uppercase">${p.name}</h4>
                <p class="text-red-600 font-bold text-xs">R$ ${p.basePrice.toFixed(2)}</p>
            </div>
            <i class="fas fa-plus-circle text-gray-300 text-xl"></i>
        </div>
    `,
    )
    .join("");
}

/**
 * Oculta o modal interno de gerenciamento de modificadores/opções da comanda ativa.
 */
function closeAdminTableModal() {
  document.getElementById("admin-table-item-modal").classList.add("hidden");
}

/**
 * Abre a janela de detalhamento e quantidade para inclusão de um item em comanda de mesa.
 * Adiciona salvaguarda temporal para prevenir que desvios de navegação ocultem a seção de mesas.
 * @param {Object} product - Payload do produto selecionado
 */
function openProductDetailsForTable(product) {
  const modal = document.getElementById("admin-table-item-modal");
  if (!modal) return;

  // 1. Exibe o modal
  modal.classList.remove("hidden");

  // 2. Renderiza o conteúdo (sua função copiada)
  openProductDetails(product);

  // 3. Segurança: Garante que o Admin não saia da tela de mesas
  setTimeout(() => {
    document.getElementById("section-tables").classList.remove("hidden");
  }, 10);

  // 4. Configura o botão de confirmação do Modal
  const btnConfirm = document.getElementById("btn-add-to-table");
  if (btnConfirm) {
    btnConfirm.innerText = `ADICIONAR À MESA ${selectedTable}`;
    btnConfirm.onclick = (e) => {
      e.preventDefault();
      saveItemToTable(product);
      closeAdminTableModal();
    };
  }
}

/**
 * Executa uma busca por texto parcial sobre a listagem compacta de produtos das comandas.
 */
function filterMenuTable() {
  const term = document
    .getElementById("search-table-product")
    .value.toLowerCase();
  const filtered = allProductsGlobal.filter(
    (p) => p.name.toLowerCase().includes(term) && p.status === "ACTIVE",
  );
  const container = document.getElementById("table-menu-container");
  renderProductsForAdmin(filtered, container);
}

/**
 * Extrai os parâmetros definidos no formulário (Tamanho, Adicionais e Observações) e consolida
 * um objeto unificado de item de comanda. Sincroniza os estados locais e invoca o motor de persistência.
 * @param {Object} product - O objeto de metadados do produto adicionado
 */
function saveItemToTable(product) {
  // 1. Validações iniciais básicas
  const selectedSku = document.querySelector('input[name="sku-opt"]:checked');
  if (!selectedSku)
    return Swal.fire("Atenção", "Selecione um tamanho/opção.", "warning");

  if (!selectedTable)
    return Swal.fire("Erro", "Nenhuma mesa selecionada.", "error");

  // Instância do Toast para validações rápidas
  const Toast = Swal.mixin({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
  });

  // 2. Validação de Modificadores (Mínimo e Máximo por Grupo)
  const groups = product.modifiers || [];
  for (const group of groups) {
    const activeItemsInGroup = group.items
      ? group.items.filter((i) => i.status === "ACTIVE")
      : [];
    if (activeItemsInGroup.length === 0) continue;

    const totalSelected = Array.from(
      document.querySelectorAll(`.modifier-qty[data-group="${group.name}"]`),
    ).reduce((sum, input) => sum + (parseInt(input.value) || 0), 0);

    if (totalSelected < group.min) {
      Toast.fire({
        icon: "warning",
        title: `O grupo "${group.name}" é obrigatório.`,
        text: `Selecione pelo menos ${group.min} itens.`,
      });
      return; // Para a execução se faltar item obrigatório
    }

    if (totalSelected > group.max) {
      Toast.fire({
        icon: "error",
        title: "Limite excedido",
        text: `O grupo "${group.name}" permite no máximo ${group.max} itens.`,
      });
      return; // Para a execução se estourar o limite
    }
  }

  // 3. Validação de Sabores (Se houver a opção no layout)
  const flavorElement = document.querySelector(
    'input[name="selected-flavor"]:checked',
  );
  const hasFlavors =
    document.querySelectorAll('input[name="selected-flavor"]').length > 0;
  if (hasFlavors && !flavorElement) {
    return Swal.fire(
      "Atenção",
      "Por favor, selecione um sabor para continuar.",
      "warning",
    );
  }

  // 4. Captura de valores básicos e quantidade
  const qty = parseInt(document.getElementById("main-qty").value) || 1;
  const priceBase = parseFloat(selectedSku.value) || 0;

  // 5. Processamento de modificadores (Adicionais)
  let modsTotalUnitario = 0;
  let modsList = [];

  document.querySelectorAll(".modifier-qty").forEach((input) => {
    const val = parseInt(input.value) || 0;
    if (val > 0) {
      const priceModifier = parseFloat(input.dataset.price) || 0;
      modsTotalUnitario += priceModifier * val;
      modsList.push(`${val}x ${input.dataset.name}`);
    }
  });

  // Se houver sabor selecionado, adiciona ao texto descritivo
  if (flavorElement && flavorElement.value) {
    modsList.unshift(`Sabor: ${flavorElement.value}`);
  }

  // 6. Montagem do objeto do item calculado corretamente
  const precoUnitarioTotal = priceBase + modsTotalUnitario;
  const itemComanda = {
    productId: product.id || "ID-NAO-ENCONTRADO",
    category: product.categoryId || product.category || "Geral",
    name: product.name,
    sku: selectedSku.dataset.name || "Padrão",
    qty: qty,
    priceUnit: precoUnitarioTotal,
    total: precoUnitarioTotal * qty,
    details: modsList.join(", "),
    obs: document.getElementById("product-note")?.value || "",
  };

  // 7. Atualização do estado local da Mesa
  if (!tablesData[selectedTable]) tablesData[selectedTable] = [];
  tablesData[selectedTable].push(itemComanda);

  // 8. Atualização da UI e Sincronização
  updateTableSummary();
  renderTablesGrid();
  saveTablesToStorage();

  // 9. Feedback e fechamento do modal
  closeAdminTableModal();

  Toast.fire({
    icon: "success",
    title: `Item adicionado à Mesa ${selectedTable}`,
    timer: 1500,
  });
}

/**
 * Executa a totalização matemática dos consumos da comanda ativa na mesa em edição.
 * Reconstrói dinamicamente as linhas de resumo injetando botões de expurgo por índice físico.
 */
function updateTableSummary() {
  const container = document.getElementById("current-table-items");
  const items = tablesData[selectedTable] || [];
  let total = 0;

  container.innerHTML = items
    .map((item, index) => {
      total += item.total;
      return `
            <div class="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-gray-800">${item.qty}x ${item.name}</span>
                    <span class="font-black">R$ ${item.total.toFixed(2)}</span>
                </div>
                <p class="text-gray-500">${item.sku} ${item.details ? " • " + item.details : ""}</p>
                ${item.obs ? `<p class="text-red-500 italic mt-1 font-medium">Obs: ${item.obs}</p>` : ""}
                <button onclick="removeItemFromTable(${index})" class="mt-2 text-red-500 font-bold uppercase text-[9px] hover:underline">Remover</button>
            </div>
        `;
    })
    .join("");

  // Controla a exibição do botão de impressão se houver itens na mesa
  const containerAcoesPrint = document.getElementById("table-print-actions");
  if (containerAcoesPrint) {
    if (items.length > 0) {
      containerAcoesPrint.innerHTML = `
        <button onclick="printTablePartialOnly()" class="w-full mt-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95">
          <i class="fas fa-print"></i>
          <span>IMPRIMIR PARCIAL (CONFERÊNCIA)</span>
        </button>
        <button onclick="lancarAbatimentoParcialMesa()" class="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95">
          <i class="fas fa-dollar-sign"></i>
          <span>LANÇAR ABATIMENTO (PAGTO PARCIAL)</span>
        </button>
      `;
    } else {
      containerAcoesPrint.innerHTML = "";
    }
  }

  if (items.length === 0) {
    container.innerHTML =
      '<div class="text-center py-6"><i class="fas fa-receipt text-gray-200 text-3xl mb-2"></i><p class="text-gray-400 text-xs font-medium">Comanda vazia</p></div>';
  }

  document.getElementById("table-total").innerText = `R$ ${total.toFixed(2)}`;
  document.getElementById("table-subtotal").innerText =
    `R$ ${total.toFixed(2)}`;
}

/**
 * Remove cirurgicamente um item específico de uma comanda através do seu índice posicional.
 * Sincroniza as alterações locais e força a redemarcação da grade de dados.
 * @param {number} index - Posição do item no vetor interno da comanda da mesa
 */
function removeItemFromTable(index) {
  Swal.fire({
    title: 'Tem certeza?',
    text: "Você não poderá reverter esta ação!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sim, remover!',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      // Executa a remoção e atualização apenas se o usuário confirmar
      tablesData[selectedTable].splice(index, 1);
      saveTablesToStorage();
      updateTableSummary();
      renderTablesGrid();

      // Feedback visual de sucesso opcional
      Swal.fire(
        'Removido!',
        'O item foi removido com sucesso.',
        'success'
      );
    }
  });
}

/**
 * ============================================================================
 * 🍽️ MÓDULO DE CONTROLE DE COMANDAS (TABLES MANAGEMENT SYSTEM)
 * ============================================================================
 */

/**
 * Consolida o fechamento financeiro da mesa ativa, monta o payload em estrita
 * conformidade com o Schema/Classe de pedidos, despacha para a API e aciona a impressão.
 */
async function closeTableAccount() {
  const itemsMesa = tablesData[selectedTable];

  if (!itemsMesa || itemsMesa.length === 0) {
    return Swal.fire({ icon: "error", title: "Mesa sem itens!" });
  }

  const result = await Swal.fire({
    title: `Fechar Mesa ${selectedTable}?`,
    text: "Confirma o encerramento da conta e impressão?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sim, Finalizar!",
    confirmButtonColor: "#ea1d2c",
  });

  if (!result.isConfirmed) return;

  // Pegamos o ID do Admin logado para satisfazer a auditoria do servidor
  // currentUser costuma vir da sua função restaurarSessao()
  const adminId = currentUser?.id || currentUser?.sub || currentUser?._id;
  const subtotal = itemsMesa.reduce((sum, item) => sum + item.total, 0);

  // MONTAGEM DO OBJETO COMPATÍVEL COM SEU SCHEMA/CLASSE
  const pedidoMesa = {
    companyId: typeof storeTag !== "undefined" ? storeTag : "ADMIN-LOCAL",
    userId: adminId, // 🔥 Preenche o userId com o ID do Admin
    // userId: null, // Pode omitir ou enviar null, já que no Schema é opcional agora
    cliente: {
      nome: `Mesa ${selectedTable}`,
      telefone: "000000000", // Valor padrão para passar na validação se necessário
      email: "atendimento@local.com",
    },
    // --- BLOCO DE SEGURANÇA JURÍDICA (Snapshot) ---
    consentimento: {
      aceitou: true,
      dataHoraAceite: new Date().toISOString(),
      userAgent: navigator.userAgent, // Identifica o dispositivo do cliente
      versaoTermos: "v1.2024-05", // Ajuda a identificar qual era a versão do código
      conteudoTermos: legalData.termos.content, // Salva o texto exato dos termos
      conteudoPrivacidade: legalData.privacidade.content, // Salva o texto da privacidade
    },
    // ----------------------------------------------
    itens: itemsMesa.map((item) => ({
      productId: item.productId,
      name: item.name,
      category: item.category || "Geral", // Campo exigido no seu itemSchema
      size: item.sku,
      quantity: item.qty,
      unitPrice: item.priceUnit, // Nome exato do seu Schema
      totalPrice: item.total, // Nome exato do seu Schema
      extras: item.details ? [item.details] : [], // Seu Schema espera Array de Strings
      notes: item.obs,
    })),
    pagamento: {
      metodo: "BALCÃO",
      total: subtotal,
      status: "PAID", // Como está fechando no balcão, já marcamos como pago
    },
    entrega: {
      tipo: "DINE_IN", // Nome exato do seu enum na Classe/Schema
      mesa: selectedTable,
      taxaEntrega: 0,
    },
    status: "CONFIRMED", // Inicia como confirmado para ir direto para a cozinha/impressão
  };

  try {
    // 1. Salva no Banco via sua API
    await criarPedidoNoSistema(pedidoMesa);

    // 3. Limpa os dados locais (F5 não trará os itens de volta pois a mesa fechou)
    tablesData[selectedTable] = [];
    if (typeof saveTablesToStorage === "function") saveTablesToStorage();

    renderTablesGrid();
    cancelTableSelection();

    Swal.fire({
      icon: "success",
      title: "Conta Fechada!",
      text: "O pedido foi registrado e enviado para a impressora.",
      timer: 2000,
      showConfirmButton: false,
    });
  } catch (err) {
    Swal.fire({
      icon: "error",
      title: "Erro ao fechar mesa",
      text: err.message,
    });
  }
}

/**
 * Despacha o payload consolidado do pedido de mesa para persistência via POST.
 * @param {Object} pedidoFinal - Objeto mapeado do pedido
 * @returns {Promise<Object>} Retorna o documento persistido retornado pela API
 */
async function criarPedidoNoSistema(pedidoFinal) {
  Swal.fire({
    title: "Processando pedido...",
    didOpen: () => Swal.showLoading(),
    allowOutsideClick: false,
  });

  const res = await fetch(`https://prafoodapi.onrender.com/pedidos`, {
    // Usando a constante de ambiente que definimos antes
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pedidoFinal),
  });

  const result = await res.json();

  if (!res.ok) {
    throw new Error(result.error || result.message || "Erro ao salvar pedido.");
  }

  return result.data; // Retorna o pedido criado (contendo o ID gerado pelo banco)
}

/**
 * ============================================================================
 * 📦 MÓDULO DE RENDERIZAÇÃO DINÂMICA DE ATRIBUTOS E OPCIONAIS
 * ============================================================================
 */

/**
 * Constrói a interface reativa de customização do produto selecionado.
 * Mapeia os SKUs ativos avaliando os níveis de estoque e injeta grupos de modificadores.
 * @param {Object} product - O modelo de dados do produto carregado
 */
function openProductDetails(product) {
  currentProduct = product;
  switchTab("details");
  const content = document.getElementById("product-details-content");

  // 1. Renderizar SKUs (Tamanhos)
  const skusHTML = (product.skus || [])
    .map((sku, index) => {
      const isOutOfStock = sku.stock <= 0;
      return `
            <label class="flex-1 ${isOutOfStock ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}">
                <input type="radio" name="sku-opt" value="${sku.price}" 
                    class="peer hidden" 
                    data-name="${sku.name}"
                    data-stock="${sku.stock}"
                    ${index === 0 && !isOutOfStock ? "checked" : ""} 
                    ${isOutOfStock ? "disabled" : ""}
                    onchange="renderAttributes(${index}); updateTotal(); resetMainQty()">
                <div class="p-3 border rounded-xl text-center peer-checked:border-red-600 peer-checked:bg-red-50 transition-all">
                    <span class="block font-bold text-xs uppercase">${sku.name}</span>
                    <span class="block text-xs text-gray-500 font-normal">R$ ${sku.price.toFixed(2)}</span>
                    ${isOutOfStock ? '<span class="text-[10px] text-red-500 font-bold">ESGOTADO</span>' : ""}
                </div>
            </label>
        `;
    })
    .join("");

  // 2. Renderizar Grupos de Modificadores Dinamicamente
  const modifiersHTML = (product.modifiers || [])
    .map((group, groupIndex) => {
      // FILTRO: Só mostra itens ATIVOS
      const activeItems = group.items.filter(
        (item) => item.status === "ACTIVE",
      );

      if (activeItems.length === 0) return ""; // Se não tiver nada ativo no dia, nem mostra o grupo

      return `
        <div class="mt-6 border-t pt-4">
            <div class="flex justify-between items-center mb-3">
                <h3 class="font-bold text-xs text-gray-500 uppercase">${groupIndex + 2}. ${group.name}</h3>
                <span class="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-400">
                    Min: ${group.min} / Máx: ${group.max}
                </span>
            </div>
            <div class="space-y-2">
                ${activeItems
                  .map(
                    (item, itemIndex) => `
                    <div class="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                        <div>
                            <span class="text-sm font-medium text-gray-700">${item.name}</span>
                            ${item.price > 0 ? `<span class="block text-[10px] text-gray-400">+ R$ ${item.price.toFixed(2)}</span>` : ""}
                        </div>
                        <div class="flex items-center gap-3 bg-white rounded-lg border p-1">
                            <button onclick="updateModifierQty('${groupIndex}', '${itemIndex}', -1)" class="w-7 h-7 text-red-600 font-bold">-</button>
                            <input type="number" 
                                id="mod-${groupIndex}-${itemIndex}" 
                                value="0" 
                                data-price="${item.price}" 
                                data-name="${item.name}" 
                                data-group="${group.name}"
                                data-max="${group.max}"
                                class="modifier-qty w-6 text-center text-sm font-bold border-none bg-transparent" readonly>
                            <button onclick="updateModifierQty('${groupIndex}', '${itemIndex}', 1)" class="w-7 h-7 text-red-600 font-bold">+</button>
                        </div>
                    </div>
                `,
                  )
                  .join("")}
            </div>
        </div>
      `;
    })
    .join("");

  content.innerHTML = `
        <div class="space-y-6 pb-20">
            ${product.images?.[0] ? `<img src="${product.images[0]}" class="w-full h-48 object-cover rounded-xl shadow-sm">` : ""}
            <div>
                <h2 class="text-2xl font-bold text-gray-800">${product.name}</h2>
                <p class="text-gray-500 text-sm mt-1">${product.description || ""}</p>
            </div>

            <div>
                <h3 class="font-bold text-xs text-gray-500 uppercase mb-3">1. Escolha o Tamanho</h3>
                <div class="flex gap-2">${skusHTML}</div>
            </div>

            <div id="sku-attributes-container"></div>
            
            <div id="modifiers-dynamic-container">
                ${modifiersHTML}
            </div>

            <div class="flex items-center justify-between pt-4 border-t">
                <span class="font-bold text-gray-700">Quantidade do pedido</span>
                <div class="flex items-center gap-4 bg-gray-100 rounded-xl p-1">
                    <button onclick="updateQty('main-qty', -1)" class="w-10 h-10 bg-white rounded-lg shadow-sm text-xl font-bold">-</button>
                    <input type="number" id="main-qty" value="1" class="w-8 text-center font-bold bg-transparent border-none" readonly>
                    <button onclick="updateQty('main-qty', 1)" class="w-10 h-10 bg-white rounded-lg shadow-sm text-xl font-bold">+</button>
                </div>
            </div>

            <div class="pt-4">
                <h3 class="font-bold text-xs text-gray-500 uppercase mb-2">Alguma observação?</h3>
                <textarea id="product-note" placeholder="Ex: Tirar cebola..." class="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-600 outline-none resize-none" rows="3"></textarea>
            </div>
        </div>
    `;

  renderAttributes(0);
}

/**
 * Incrementa ou decrementa a quantidade alocada de um subitem modificador.
 * Valida de forma rígida tetos operacionais máximos do agrupamento lógico de opcionais.
 */
function updateModifierQty(groupIndex, itemIndex, delta) {
  const id = `mod-${groupIndex}-${itemIndex}`;
  const input = document.getElementById(id);
  const maxGroup = parseInt(input.dataset.max);

  // Contar quanto já foi selecionado NESSE grupo
  const groupInputs = document.querySelectorAll(`[id^="mod-${groupIndex}-"]`);
  let currentGroupTotal = 0;
  groupInputs.forEach((inp) => (currentGroupTotal += parseInt(inp.value)));

  let newVal = parseInt(input.value) + delta;

  if (newVal < 0) newVal = 0;

  // Validar se ultrapassa o máximo do grupo (ex: Max 4 acompanhamentos)
  if (delta > 0 && currentGroupTotal >= maxGroup) {
    Toast.fire({
  icon: "warning",
  title: `O limite deste grupo é de ${maxGroup} itens.`,
});
    return;
  }

  input.value = newVal;
  if (typeof updateTotal === "function") updateTotal();
}

/**
 * Transpõe as chaves internas de atributos do SKU (ex: Sabores estruturados) em rádio inputs.
 * @param {number} skuIndex - Posição física da variante mapeada
 */
function renderAttributes(skuIndex) {
  const container = document.getElementById("sku-attributes-container");
  const sku = currentProduct.skus[skuIndex];

  if (!sku || !sku.attributes) {
    container.innerHTML = "";
    return;
  }

  // Pegamos todos os valores (ex: "carne", "frango") dos atributos
  const values = Object.values(sku.attributes);

  // Geramos os botões. Todos compartilham o name="selected-flavor"
  // para que o usuário só possa escolher UM.
  container.innerHTML = `
        <div class="mt-4">
            <h3 class="font-bold text-xs text-gray-500 uppercase mb-2">Escolha o Sabor</h3>
            <div class="flex flex-wrap gap-2">
                ${values
                  .map(
                    (val, i) => `
                    <label class="cursor-pointer">
                        <input type="radio" 
                               name="selected-flavor" 
                               onchange="updateTotal()"
                               value="${val}" 
                               class="peer hidden" 
                               ${i === 0 ? "checked" : ""}>
                        <div class="px-4 py-2 border rounded-full peer-checked:bg-red-600 peer-checked:text-white transition-all text-sm">
                            ${val}
                        </div>
                    </label>
                `,
                  )
                  .join("")}
            </div>
        </div>
    `;
}

/**
 * Altera a volumetria central de itens do carrinho. Intercepta limites físicos
 * do estoque dinâmico associado ao metadado do SKU ativo emitindo alertas em tempo real.
 */
function updateQty(id, delta) {
  const input = document.getElementById(id);
  let newVal = parseInt(input.value) + delta;

  if (id === "main-qty") {
    // Busca o SKU selecionado para saber o limite de estoque
    const selectedSku = document.querySelector('input[name="sku-opt"]:checked');
    const maxStock = selectedSku ? parseInt(selectedSku.dataset.stock) : 99;

    if (newVal < 1) newVal = 1;
    if (newVal > maxStock) {
      Toast.fire({
        icon: "warning",
        title: `Ops! Só temos ${maxStock} unidades em estoque.`,
      });
      newVal = maxStock;
    }
  } else {
    // Lógica para adicionais (modifiers) costuma ser livre ou limitada por regra de negócio
    if (newVal < 0) newVal = 0;
  }

  input.value = newVal;
  if (typeof updateTotal === "function") updateTotal();
}

/**
 * Persiste de forma concorrente a matriz de comandas no LocalStorage (tolerância a falhas local)
 * e dispara sincronização assíncrona na nuvem via POST com suporte a sessões cruzadas (`Credentials`).
 */
function resetMainQty() {
  const input = document.getElementById("main-qty");
  if (input) input.value = 1;
}

/**
 * Persiste de forma concorrente a matriz de comandas no LocalStorage (tolerância a falhas local)
 * e dispara sincronização assíncrona na nuvem via POST com suporte a sessões cruzadas (`Credentials`).
 */
async function saveTablesToStorage() {
  // 1. Backup imediato no navegador (evita perda se a internet oscilar)
  localStorage.setItem("prafood_tables_data", JSON.stringify(tablesData));

  // 2. Identificação da empresa (vinda da sua variável global ou config)
  const companyId = typeof storeTag !== "undefined" ? storeTag : "ADMIN-LOCAL";

  try {
    // 3. Sincronização com o Backend
    const response = await fetch(`https://prafoodapi.onrender.com/products/tables/sync`, {
      method: "POST",
      // ADICIONE OU VERIFIQUE ESTAS DUAS LINHAS ABAIXO:
      credentials: "include", // Permite enviar cookies/sessão para o servidor
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        companyId: companyId,
        tables: tablesData, // Envia o objeto com todas as 10 mesas
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Erro ao sincronizar com o servidor");
    }

    console.log("✅ Mesas sincronizadas no banco de dados com sucesso.");
  } catch (err) {
    // Log detalhado no console para você (desenvolvedor)
    console.warn("⚠️ Detalhes do erro de sincronização:", err);

    if (typeof Swal !== "undefined") {
      const Toast = Swal.mixin({
        toast: true,
        position: "bottom-end",
        showConfirmButton: false,
        timer: 5000, // Aumentei o tempo para dar tempo de ler o erro
        timerProgressBar: true,
      });

      // Aqui ele mostra "Modo Offline" e o motivo real logo abaixo
      Toast.fire({
        icon: "warning",
        title: "Sincronização Falhou",
        text: `Motivo: ${err.message}`, // <--- EXIBE O ERRO REAL AQUI
      });
    }
  }
}

/**
 * ============================================================================
 * 🖨️ MÓDULO DE IMPRESSÃO (PERIPHERAL INTEGRATION)
 * ============================================================================
 */
function openPrinterModal() {
  document.getElementById("printer-modal").classList.remove("hidden");
}

function closePrinterModal() {
  document.getElementById("printer-modal").classList.add("hidden");
}

/**
 * Varre o segmento de rede local consumindo rotas de descobrimento de hardware socket (Porta 9100).
 * Altera estados vetoriais e reconstrói a listagem dinâmica de periféricos.
 */
async function scanNetworkPrinters() {
  const scanIcon = document.getElementById("scan-icon");
  const listContainer = document.getElementById("printer-list");

  // Inicia estado visual de carregamento
  scanIcon.classList.add("fa-spin");
  listContainer.innerHTML = `
    <div class="flex items-center justify-center gap-2 py-4 text-blue-600">
      <i class="fas fa-spinner fa-spin text-sm"></i>
      <span class="text-xs font-medium">Buscando na rede...</span>
    </div>
  `;

  try {
    const response = await fetch("https://prafoodapi.onrender.com/pedidos/discover");
    if (!response.ok) throw new Error("Erro na requisição de busca");

    const printers = await response.json(); // Espera um array: [{ip, port, name}]
    listContainer.innerHTML = ""; // Limpa o carregamento

    if (printers.length === 0) {
      listContainer.innerHTML = `
        <p class="text-center text-xs text-gray-500 py-3">
          Nenhuma impressora encontrada na porta 9100.
        </p>
      `;
      return;
    }

    // Renderiza cada impressora encontrada na lista
    printers.forEach((printer) => {
      const card = document.createElement("div");
      card.className =
        "flex items-center justify-between p-2.5 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/40 cursor-pointer transition group animate-fade-in";
      card.onclick = () => selectAndConnectPrinter(printer.ip, printer.name);

      card.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="p-2 bg-gray-100 group-hover:bg-blue-100 group-hover:text-blue-600 text-gray-500 rounded-lg transition">
            <i class="fas fa-network-wired text-xs"></i>
          </div>
          <div class="text-left">
            <p class="text-xs font-bold text-gray-700">${printer.name}</p>
            <p class="text-[10px] text-gray-400">${printer.ip}:${printer.port}</p>
          </div>
        </div>
        <i class="fas fa-chevron-right text-gray-300 group-hover:text-blue-500 text-xs transition mr-1"></i>
      `;
      listContainer.appendChild(card);
    });
  } catch (error) {
    console.error("[FRONT_DISCOVER_ERROR]", error);
    listContainer.innerHTML = `
      <p class="text-center text-xs text-red-500 py-3 font-medium">
        Falha ao escanear rede local.
      </p>
    `;
  } finally {
    scanIcon.classList.remove("fa-spin");
  }
}

/**
 * Registra o handshake lógico entre o back-end e a impressora selecionada na rede.
 */
async function selectAndConnectPrinter(ip, name) {
  updateUIStatus("conectando", name, ip);

  try {
    const response = await fetch("https://prafoodapi.onrender.com/pedidos/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip: ip }),
    });

    const result = await response.json();

    if (result.success) {
      updateUIStatus("conectado", name, ip);
      // ✅ NOVO: Salva os dados da impressora no navegador para lembrar no F5
      localStorage.setItem("ultima_impressora_ip", ip);
      localStorage.setItem("ultima_impressora_nome", name);
    } else {
      alert(`Falha na conexão: ${result.error || "Erro desconhecido"}`);
      updateUIStatus("desconectado");
    }
  } catch (error) {
    console.error("[FRONT_CONNECT_ERROR]", error);
    alert("Não foi possível estabelecer comunicação com o servidor.");
    updateUIStatus("desconectado");
  }
}

/**
 * Dispara comando sequencial de teste físico de caracteres direto nas bobinas térmicas.
 */
async function testPrint() {
  const btnTest = document.getElementById("btn-test-print");
  const originalText = btnTest.innerText;

  btnTest.disabled = true;
  btnTest.innerText = "Enviando...";

  try {
    const response = await fetch(`https://prafoodapi.onrender.com/pedidos/test-print`, {
      method: "POST",
    });
    const result = await response.json();

    if (result.success) {
      console.log("Impressão de teste concluída com sucesso.");
    } else {
     Toast.fire({
      icon: "error",
      title: `Erro no teste físico: ${result.error}`,
    });
    }
  } catch (error) {
    console.error("[FRONT_TEST_ERROR]", error);
    Toast.fire({
    icon: "error",
    title: "Erro de rede ao tentar enviar o teste de impressão.",
  });
  } finally {
    btnTest.disabled = false;
    btnTest.innerText = originalText;
  }
}

/**
 * Mutador auxiliar de layout responsável pela inversão cromática e de rótulos do módulo de impressão.
 */
function updateUIStatus(state, name = "Nenhum", ip = "0.0.0.0") {
  const badge = document.getElementById("status-badge");
  const textStatus = document.getElementById("printer-status-text");
  const txtName = document.getElementById("active-printer-name");
  const txtIp = document.getElementById("active-printer-ip");
  const btnTest = document.getElementById("btn-test-print");

  txtName.innerText = name;
  txtIp.innerText = ip;

  if (state === "conectando") {
    badge.className = "p-3 bg-amber-100 text-amber-600 rounded-lg";
    textStatus.className = "font-bold text-amber-600 text-sm";
    textStatus.innerText = "Conectando...";
    btnTest.disabled = true;
    btnTest.classList.add("opacity-50", "cursor-not-allowed");
  } else if (state === "conectado") {
    badge.className = "p-3 bg-green-100 text-green-600 rounded-lg";
    textStatus.className = "font-bold text-green-600 text-sm";
    textStatus.innerText = "Conectada / Online";

    txtName.classList.remove("text-gray-400");
    txtIp.classList.remove("text-gray-400");

    btnTest.disabled = false;
    btnTest.classList.remove("opacity-50", "cursor-not-allowed");
  } else {
    // desconectado
    badge.className = "p-3 bg-gray-100 text-gray-400 rounded-lg";
    textStatus.className = "font-bold text-gray-400 text-sm";
    textStatus.innerText = "Desconectada";

    txtName.innerText = "Nenhum";
    txtIp.innerText = "0.0.0.0";
    txtName.classList.add("text-gray-400");
    txtIp.classList.add("text-gray-400");

    btnTest.disabled = true;
    btnTest.classList.add("opacity-50", "cursor-not-allowed");
  }
}

/* ==========================================================================
   🚀 RECONEXÃO AUTOMÁTICA (RODA LOGO APÓS O CARREGAMENTO DA PÁGINA)
   ========================================================================== */
// Adicione isto ao final do script para corrigir o comportamento do Refresh (F5)
window.addEventListener("DOMContentLoaded", () => {
    // Se a aplicação não estiver na tela de login (ou se você usar hashes para controlar as abas)
    if (window.location.hash !== "#auth") {
        // Se houver um cookie/sessão ativa ou se o dashboard estiver visível por padrão:
        showDashboard(); 
    }
});

/**
 * ============================================================================
 * 🏪 CONTROLADORES DE STATUS DA UNIDADE COMERCIAL
 * ============================================================================
 */

/**
 * Varre e injeta de forma síncrona o botão de estado de atendimento em todos
 * os nós de classe mapeados (suporta replicação responsiva mobile/desktop).
 * @param {Object} user - Documento do usuário contendo o storeStatus ativo
 */
function renderStoreStatus(user) {
  // 1. querySelectorAll retorna uma NodeList (uma lista de elementos)
  const containers = document.querySelectorAll(".store-status-box");

  // Verificação de segurança
  if (!containers.length || !user) return;

  const isActive = user.storeStatus === "ACTIVE";

  // Estilos baseados no status
  const statusClass = isActive
    ? "bg-green-50 border-green-200 text-green-600 hover:bg-green-100"
    : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100";

  // 2. Definimos a variável buttonHTML PRIMEIRO
  const buttonHTML = `
    <button onclick="toggleUserStatus('${user.id}', '${user.storeStatus}')" 
            class="w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-2 md:px-4 py-2 rounded-xl border transition-all ${statusClass}">
        <div class="flex flex-col items-center min-w-[30px] md:min-w-[40px]">
            <i class="fas ${isActive ? "fa-door-open" : "fa-door-closed"} text-base md:text-lg"></i>
        </div>
        <div class="flex flex-col items-start leading-tight">
            <span class="text-[9px] md:text-[10px] font-black uppercase">${isActive ? "ABERTA" : "FECHADA"}</span>
            <span class="hidden md:block text-[9px] opacity-70">Clique para ${isActive ? "fechar" : "abrir"}</span>
        </div>
    </button>
  `;

  // 3. Agora percorremos a lista e injetamos o HTML em cada container
  containers.forEach((container) => {
    container.innerHTML = buttonHTML;
  });
}

/**
 * ============================================================================
 * ⚖️ TERMINAIS DE CONFORMIDADE DE REGULAMENTO (COMPLIANCE CENTER - LGPD)
 * ============================================================================
 */
function openLegalModal(type) {
  const modal = document.getElementById("legalModal");
  const title = document.getElementById("modalTitle");
  const content = document.getElementById("modalContent");

  title.innerText = legalData[type].title;
  content.innerHTML = legalData[type].content;

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.style.overflow = "hidden"; // Trava o scroll da página
}

function closeLegalModal() {
  const modal = document.getElementById("legalModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  document.body.style.overflow = "auto"; // Destrava o scroll
}

// Dicionário Estático de Textos Regulatórios e de Legitimidade Operacional
const legalData = {
  termos: {
    title: "Termos de Uso",
    content: `
        <h4 class="font-bold text-gray-800">1. Objeto</h4>
        <p>O PraFood atua como plataforma de intermediação de pedidos entre o cliente e o estabelecimento comercial.</p>
        <h4 class="font-bold text-gray-800">2. Responsabilidades</h4>
        <p>O estabelecimento é o único responsável pelo preparo, qualidade e entrega dos produtos. O usuário é responsável por fornecer dados corretos de entrega.</p>
        <h4 class="font-bold text-gray-800">3. Cancelamento</h4>
        <p>O cancelamento só poderá ser solicitado antes do início do preparo pelo restaurante. Itens personalizados seguem regras específicas do CDC.</p>
        <h4 class="font-bold text-gray-800">4. Pagamentos</h4>
        <p>Valores e taxas são definidos pelo restaurante. Erros no processamento devem ser relatados ao suporte imediatamente.</p>
      `,
  },
  privacidade: {
    title: "Política de Privacidade",
    content: `
        <h4 class="font-bold text-gray-800 uppercase text-xs text-red-500">Conformidade LGPD</h4>
        <p><strong>Dados Coletados:</strong> Nome, Telefone e Endereço.</p>
        <h4 class="font-bold text-gray-800">1. Uso dos Dados</h4>
        <p>Seus dados são usados exclusivamente para: Processar o pedido, realizar a entrega e garantir a segurança do pagamento.</p>
        <h4 class="font-bold text-gray-800">2. Compartilhamento</h4>
        <p>Compartilhamos seus dados apenas com o restaurante (preparo) e o entregador (logística). Não vendemos seus dados a terceiros.</p>
        <h4 class="font-bold text-gray-800">3. Seus Direitos</h4>
        <p>Você pode solicitar a exclusão total dos seus dados da nossa base a qualquer momento enviando um e-mail para o suporte.</p>
      `,
  },
};

/**
 * Permite conectar diretamente inserindo o IP, sem depender do scanner automático
 */
async function connectManualPrinter() {
  const ipInput = document.getElementById("manual-printer-ip");
  const ip = ipInput.value.trim();

  // Validação de IP usando o seu Toast
  if (!ip || ip.split(".").length !== 4) {
    Toast.fire({
      icon: "warning",
      title: "Endereço de IP inválido",
      text: "Por favor, digite um IP no formato correto (Ex: 192.168.1.150).",
    });
    return;
  }

  // Chama a mesma função que o clique do card chamaria, simulando o nome da Epson
  await selectAndConnectPrinter(ip, "Epson TM (IP Manual)");
}

/**
 * Compila os dados da mesa ativa no formato exato exigido pelo Schema de pedidos,
 * mas despacha o payload exclusivamente para a rota de IMPRESSÃO PARCIAL.
 * Inclui confirmação prévia, mantendo a mesa aberta e livre para novas reimpressões.
 */
async function printTablePartialOnly() {
  const itemsMesa = tablesData[selectedTable];

  if (!itemsMesa || itemsMesa.length === 0) {
    return Swal.fire({ icon: "error", title: "Mesa sem itens!" });
  }

  // 🔥 ADICIONADO: Janela de confirmação idêntica ao seu padrão de fechamento
  const confirmacao = await Swal.fire({
    title: `Imprimir Parcial da Mesa ${selectedTable}?`,
    text: "Deseja enviar a conferência de consumo atual para a impressora?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sim, Imprimir!",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#3085d6", // Azul para diferenciar do vermelho de fechamento
    cancelButtonColor: "#6b7280",
  });

  if (!confirmacao.isConfirmed) return;

  // Pegamos o ID do Admin logado para manter o padrão de auditoria
  const adminId = currentUser?.id || currentUser?.sub || currentUser?._id;
  const subtotal = itemsMesa.reduce((sum, item) => sum + item.total, 0);

  // MONTAGEM DO OBJETO EM ESTRETA CONFORMIDADE COM SEU SCHEMA
  const payloadParcial = {
    companyId: typeof storeTag !== "undefined" ? storeTag : "ADMIN-LOCAL",
    userId: adminId,
    cliente: {
      nome: `Mesa ${selectedTable} (PARCIAL)`,
      telefone: "000000000",
      email: "atendimento@local.com",
    },
    // --- BLOCO DE SEGURANÇA JURÍDICA (Snapshot) ---
    consentimento: {
      aceitou: true,
      dataHoraAceite: new Date().toISOString(),
      userAgent: navigator.userAgent,
      versaoTermos: "v1.2024-05",
      conteudoTermos: legalData?.termos?.content || "",
      conteudoPrivacidade: legalData?.privacidade?.content || "",
    },
    // ----------------------------------------------
    itens: itemsMesa.map((item) => ({
      productId: item.productId,
      name: item.name,
      category: item.category || "Geral",
      size: item.sku,
      quantity: item.qty,
      unitPrice: item.priceUnit,
      totalPrice: item.total,
      extras: item.details ? [item.details] : [],
      notes: item.obs,
    })),
    pagamento: {
      metodo: "BALCÃO",
      total: subtotal,
      status: "PENDING", // Parcial fica pendente, já que não é o encerramento
    },
    entrega: {
      tipo: "DINE_IN",
      mesa: selectedTable,
      taxaEntrega: 0,
    },
    status: "CONFIRMED",
  };

  // Loader visual bloqueado idêntico ao seu padrão
  Swal.fire({
    title: "Processando parcial...",
    text: "Enviando comanda para a impressora",
    didOpen: () => Swal.showLoading(),
    allowOutsideClick: false,
  });

  try {
    // MUDANÇA CRÍTICA: Envia para a rota de impressão parcial, evitando criação de pedido/baixa no banco
    const res = await fetch(`https://prafoodapi.onrender.com/pedidos/imprimir-parcial`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesaId: selectedTable,
        dadosComanda: payloadParcial, // Envia o JSON estruturado caso o motor de impressão precise ler os itens
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      // ✅ Capta 'erro' (padrão do seu Node), 'error' ou 'message' sem ficar undefined
      const mensagemReal =
        result.erro ||
        result.error ||
        result.message ||
        "Erro desconhecido no servidor.";
      const detalheReal = result.detalhe ? `\nDetalhe: ${result.detalhe}` : "";

      const erroCompleto = `${mensagemReal}${detalheReal}`;

      alert("Resposta do Servidor Backend:\n" + erroCompleto);
      throw new Error(erroCompleto);
    }

    // SUCESSO SEM DELETAR NADA:
    // Não alteramos o tablesData[selectedTable], mantendo a mesa e o botão totalmente operacionais.
    Swal.fire({
      icon: "success",
      title: "Parcial Impressa!",
      text: "A conferência foi enviada para a impressora com sucesso.",
      timer: 2000,
      showConfirmButton: false,
    });
  } catch (err) {
    // 🔥 FAZ O SWEETALERT MOSTRAR O ERRO DETALHADO NA TELA
    Swal.fire({
      icon: "error",
      title: "Erro na Impressão da Parcial",
      html: `
        <div class="text-left bg-gray-100 p-3 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto max-h-40">
          <strong>Mensagem:</strong> ${err.message}<br><br>
          <span class="text-red-600">Verifique os logs do terminal do Agente Electron para ver qual propriedade quebrou o PDFKit.</span>
        </div>
      `,
      confirmButtonText: "Fechar",
      confirmButtonColor: "#ef4444",
    });
  }
}

/**
 * Abre uma interface para o operador lançar um pagamento parcial (abatimento)
 * para a mesa ativa, atualizando os dados e enviando a confirmação ao backend.
 */
async function lancarAbatimentoParcialMesa() {
  const itemsMesa = tablesData[selectedTable];

  if (!itemsMesa || itemsMesa.length === 0) {
    return Swal.fire({ icon: "error", title: "Mesa sem itens para abater!" });
  }

  // 1. Calcula o total atual da comanda da mesa
  const subtotalAtual = itemsMesa.reduce((sum, item) => sum + item.total, 0);

  // Se a mesa já estiver zerada devido a abatimentos anteriores
  if (subtotalAtual <= 0) {
    return Swal.fire({
      icon: "info",
      title: "Esta comanda já foi totalmente abatida!",
    });
  }

  // 2. Abre a janela solicitando o método e o valor do abatimento
  const { value: dadosAbatimento } = await Swal.fire({
    title: `Abatimento / Parcial - Mesa ${selectedTable}`,
    html: `
      <p class="text-sm text-gray-600 mb-2">Total Atual da Mesa: <strong>R$ ${subtotalAtual.toFixed(2)}</strong></p>
      
      <div class="text-left mb-3">
        <label class="block text-xs font-semibold text-gray-700 mb-1">Forma de Pagamento:</label>
        <select id="swal-metodo-pagamento" class="swal2-select w-full m-0 border border-gray-300 rounded-md p-2 text-sm">
          <option value="DINHEIRO">Dinheiro</option>
          <option value="PIX" selected>PIX</option>
          <option value="CARTAO_DEBITO">Cartão de Débito</option>
          <option value="CARTAO_CREDITO">Cartão de Crédito</option>
        </select>
      </div>

      <div class="text-left">
        <label class="block text-xs font-semibold text-gray-700 mb-1">Valor a Abater (R$):</label>
        <input id="swal-valor-abater" type="number" step="0.01" min="0.01" max="${subtotalAtual}" 
          class="swal2-input w-full m-0 p-2 text-sm border border-gray-300 rounded-md" 
          placeholder="Ex: 50.00" value="${subtotalAtual.toFixed(2)}">
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Confirmar Pagamento",
    cancelButtonText: "Voltar",
    confirmButtonColor: "#10b981", // Verde para simbolizar entrada de dinheiro
    cancelButtonColor: "#6b7280",
    preConfirm: () => {
      const metodo = document.getElementById("swal-metodo-pagamento").value;
      const valor = parseFloat(
        document.getElementById("swal-valor-abater").value,
      );

      if (isNaN(valor) || valor <= 0) {
        Swal.showValidationMessage(
          "Por favor, insira um valor válido acima de R$ 0,00",
        );
        return false;
      }
      if (valor > subtotalAtual) {
        Swal.showValidationMessage(
          `O valor não pode ser maior que o total da mesa (R$ ${subtotalAtual.toFixed(2)})`,
        );
        return false;
      }

      return { metodo, valor };
    },
  });

  // Se o usuário cancelou a operação
  if (!dadosAbatimento) return;

  // 3. Exibe o loader visual de processamento
  Swal.fire({
    title: "Registrando abatimento...",
    text: "Atualizando dados financeiros no servidor",
    didOpen: () => Swal.showLoading(),
    allowOutsideClick: false,
  });

  const adminId = currentUser?.id || currentUser?.sub || currentUser?._id;

  try {
    // 4. ✅ CORRIGIDO: Rota alterada para bater no endpoint de mesas que criamos no Back (/tables/abater-parcial)
    const res = await fetch(
      `https://prafoodapi.onrender.com/products/tables/abater-parcial`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mesaId: selectedTable,
          companyId: typeof storeTag !== "undefined" ? storeTag : "ADMIN-LOCAL",
          userId: adminId,
          valorAbatido: dadosAbatimento.valor,
          metodoPagamento: dadosAbatimento.metodo,
        }),
      },
    );

    const textoBruto = await res.text();
    let result = {};
    try {
      result = JSON.parse(textoBruto);
    } catch (e) {
      result = { message: textoBruto };
    }

    if (!res.ok) {
      const msgErro =
        result.erro ||
        result.error ||
        result.message ||
        "Erro ao processar abatimento.";
      throw new Error(msgErro);
    }

    // 5. ATUALIZAÇÃO NO FRONT-END
    if (dadosAbatimento.valor === subtotalAtual) {
      tablesData[selectedTable] = []; // Limpa a mesa pois foi totalmente paga

      if (typeof updateTableSummary === "function") updateTableSummary();

      Swal.fire({
        icon: "success",
        title: "Mesa Encerrada!",
        text: "O pagamento integral foi registrado e a mesa foi liberada.",
        timer: 3000,
        showConfirmButton: false,
      });
    } else {
      // Se o back devolveu os itens com a linha negativa embutida, atualiza o mapa
      if (result.itensAtualizados) {
        tablesData[selectedTable] = result.itensAtualizados;
      } else {
        // Fallback manual caso o back não envie o array montado
        tablesData[selectedTable].push({
          productId: `CREDITO-${Date.now()}`,
          name: `PAGTO PARCIAL (${dadosAbatimento.metodo})`,
          priceUnit: -dadosAbatimento.valor,
          qty: 1,
          total: -dadosAbatimento.valor,
        });
      }

      // Re-renderiza as tabelas e o resumo lateral para computar a linha de crédito

      if (typeof updateTableSummary === "function") updateTableSummary();

      Swal.fire({
        icon: "success",
        title: "Abatimento Registrado!",
        text: `R$ ${dadosAbatimento.valor.toFixed(2)} abatidos com sucesso. A mesa continua aberta.`,
        timer: 3000,
        showConfirmButton: false,
      });
    }
  } catch (err) {
    console.error("🚨 Erro no abatimento:", err);
    Swal.fire({
      icon: "error",
      title: "Erro ao Abater Valor",
      html: `
        <div class="text-left bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-xs overflow-auto max-h-40 border border-gray-700">
          <strong>Retorno do Servidor:</strong><br>${err.message}
        </div>
      `,
      confirmButtonText: "Fechar",
      confirmButtonColor: "#ef4444",
    });
  }
}
