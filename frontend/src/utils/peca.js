// ---------------------------------------------------------------------------
// Modelo de "peça" do brechó (camada de apresentação)
//
// O Serviço_Produtos continua genérico: nome, descrição, categoria, preço,
// estoque, imagemUrl e um mapa livre `atributos`. O brechó especializa esse
// modelo guardando os dados de vestuário em chaves conhecidas de `atributos`:
//
//   tamanho        -> "M", "38", "Único"...
//   marca          -> "Levi's", "Sem marca"...
//   estado         -> uma das chaves de ESTADOS (ex.: "seminova")
//   cor            -> uma das chaves de CORES (ex.: "terracota")
//   tecido         -> "100% algodão"...
//   medidas        -> "Busto 92 cm · Comprimento 64 cm"
//   precoOriginal  -> preço de loja em centavos (string, pois atributos são
//                     sempre strings no backend)
//
// Qualquer outra chave é tratada como "detalhe extra" e continua editável
// pelo editor de atributos dinâmicos. (Requisitos 11.2, 11.3)
// ---------------------------------------------------------------------------

export const CATEGORIAS = [
    'Vestidos',
    'Camisas & Blusas',
    'Camisetas',
    'Tricôs',
    'Jaquetas & Casacos',
    'Calças',
    'Saias',
    'Shorts',
    'Calçados',
    'Acessórios',
];

export const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', '34', '36', '38', '40', '42', '44', '46', 'Único'];

// Estados de conservação, do mais novo ao mais "vivido".
export const ESTADOS = {
    'nova-com-etiqueta': {
        rotulo: 'Nova com etiqueta',
        descricao: 'Nunca usada, ainda com a etiqueta original.',
    },
    seminova: {
        rotulo: 'Seminova',
        descricao: 'Usada poucas vezes, sem sinais de uso.',
    },
    'muito-bom': {
        rotulo: 'Muito bom estado',
        descricao: 'Sinais leves de uso, nada que comprometa.',
    },
    bom: {
        rotulo: 'Bom estado',
        descricao: 'Marcas de uso visíveis, descritas no anúncio.',
    },
    vintage: {
        rotulo: 'Vintage',
        descricao: 'Peça de época, com o charme das marcas do tempo.',
    },
};

// Paleta de cores das peças: alimenta os swatches do formulário e o
// preenchimento da ilustração quando a peça não tem foto.
export const CORES = {
    preto: { rotulo: 'Preto', hex: '#2b2726' },
    branco: { rotulo: 'Branco', hex: '#f4f1ea' },
    cinza: { rotulo: 'Cinza', hex: '#9a9693' },
    bege: { rotulo: 'Bege', hex: '#d8c3a5' },
    marrom: { rotulo: 'Marrom', hex: '#7a5236' },
    terracota: { rotulo: 'Terracota', hex: '#b5583a' },
    vermelho: { rotulo: 'Vermelho', hex: '#b0303a' },
    rosa: { rotulo: 'Rosa', hex: '#e2a3a8' },
    mostarda: { rotulo: 'Mostarda', hex: '#d39b2f' },
    verde: { rotulo: 'Verde', hex: '#5f7045' },
    azul: { rotulo: 'Azul', hex: '#3d5a80' },
    jeans: { rotulo: 'Jeans', hex: '#5b7aa0' },
    estampado: { rotulo: 'Estampado', hex: 'estampa' },
};

// Chaves de `atributos` interpretadas pelo brechó (as demais são "extras").
export const CHAVES_PECA = ['tamanho', 'marca', 'estado', 'cor', 'tecido', 'medidas', 'precoOriginal'];

const ROTULOS_CHAVE = {
    tamanho: 'Tamanho',
    marca: 'Marca',
    estado: 'Estado',
    cor: 'Cor',
    tecido: 'Tecido',
    medidas: 'Medidas',
    precoOriginal: 'Preço original',
};

/**
 * Extrai os dados de vestuário de um produto, separando os detalhes extras.
 *
 * @param {object} produto Produto vindo do Serviço_Produtos.
 * @returns {{ tamanho: string, marca: string, estado: string, cor: string,
 *   tecido: string, medidas: string, precoOriginal: number|null,
 *   extras: [string, string][] }}
 */
export function lerPeca(produto) {
    const atributos =
        produto && produto.atributos && typeof produto.atributos === 'object'
            ? produto.atributos
            : {};
    const precoOriginal = Number.parseInt(atributos.precoOriginal, 10);
    return {
        tamanho: atributos.tamanho || '',
        marca: atributos.marca || '',
        estado: atributos.estado || '',
        cor: atributos.cor || '',
        tecido: atributos.tecido || '',
        medidas: atributos.medidas || '',
        precoOriginal: Number.isFinite(precoOriginal) && precoOriginal > 0 ? precoOriginal : null,
        extras: Object.entries(atributos).filter(([chave]) => !CHAVES_PECA.includes(chave)),
    };
}

/** Rótulo legível de um estado de conservação (aceita valores livres). */
export function rotuloEstado(estado) {
    return ESTADOS[estado]?.rotulo || estado || '';
}

/** Rótulo legível de uma cor (aceita valores livres). */
export function rotuloCor(cor) {
    return CORES[cor]?.rotulo || cor || '';
}

/**
 * Rótulo + valor legíveis de um atributo qualquer, usados onde os atributos
 * aparecem "crus" (ex.: snapshot dos itens de um pedido).
 *
 * @param {string} chave
 * @param {string} valor
 * @param {(centavos: number) => string} formatarReais
 * @returns {[string, string]}
 */
export function descreverAtributo(chave, valor, formatarReais) {
    const rotulo = ROTULOS_CHAVE[chave] || chave;
    if (chave === 'estado') return [rotulo, rotuloEstado(valor)];
    if (chave === 'cor') return [rotulo, rotuloCor(valor)];
    if (chave === 'precoOriginal') return [rotulo, formatarReais(Number(valor))];
    return [rotulo, String(valor)];
}

/**
 * Percentual de economia em relação ao preço original (inteiro), ou null
 * quando não há preço original maior que o atual.
 */
export function percentualEconomia(preco, precoOriginal) {
    if (!precoOriginal || !(precoOriginal > preco)) {
        return null;
    }
    return Math.round((1 - preco / precoOriginal) * 100);
}

// Limite de frete grátis do Serviço_Carrinho (frete.js > LIMITE_FRETE_GRATIS).
// Duplicado aqui apenas para a barra de progresso da sacola; o backend
// continua sendo a fonte da verdade do valor cobrado.
export const LIMITE_FRETE_GRATIS = 50000;
