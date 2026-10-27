// ---------------------------------------------------------------------------
// Peças de exemplo do Garimpo brechó
//
// Cadastra um acervo de demonstração via API do Serviço_Produtos (POST
// /produtos), respeitando as mesmas validações da interface. Peças com um nome
// já existente são puladas, então o script pode ser executado mais de uma vez.
//
// Uso (com os contêineres rodando):
//   node scripts/seed-brecho.mjs
//   PRODUTOS_URL=http://localhost:3001 node scripts/seed-brecho.mjs
// ---------------------------------------------------------------------------

const PRODUTOS_URL = process.env.PRODUTOS_URL || 'http://localhost:3001';

const PECAS = [
    {
        nome: 'Jaqueta jeans oversized anos 90',
        categoria: 'Jaquetas & Casacos',
        descricao:
            'Lavagem clara, ombros caídos e aquele desbotado que só o tempo dá. Combina com tudo, de vestido a moletom.',
        preco: 12900,
        estoque: 1,
        atributos: { tamanho: 'G', marca: "Levi's", estado: 'vintage', cor: 'jeans', tecido: '100% algodão', medidas: 'Busto 120 cm · Comprimento 66 cm', precoOriginal: '49990' },
    },
    {
        nome: 'Vestido midi floral de viscose',
        categoria: 'Vestidos',
        descricao: 'Estampa miúda, decote V e amarração na cintura. Fresquinho para o verão.',
        preco: 8900,
        estoque: 1,
        atributos: { tamanho: 'M', marca: 'Farm', estado: 'seminova', cor: 'estampado', tecido: 'Viscose', medidas: 'Busto 90 cm · Comprimento 115 cm', precoOriginal: '39800' },
    },
    {
        nome: 'Tricô cropped trançado',
        categoria: 'Tricôs',
        descricao: 'Ponto trança, gola redonda e comprimento na cintura. Quentinho sem pesar.',
        preco: 6500,
        estoque: 1,
        atributos: { tamanho: 'P', marca: 'Zara', estado: 'muito-bom', cor: 'mostarda', tecido: 'Acrílico e lã' },
    },
    {
        nome: 'Calça pantalona de alfaiataria',
        categoria: 'Calças',
        descricao: 'Cintura alta, pregas frontais e caimento impecável. Do trabalho ao jantar.',
        preco: 9900,
        estoque: 1,
        atributos: { tamanho: '38', marca: 'Animale', estado: 'seminova', cor: 'bege', tecido: 'Poliéster com elastano', precoOriginal: '59900' },
    },
    {
        nome: 'Camisa de linho manga longa',
        categoria: 'Camisas & Blusas',
        descricao: 'Linho lavado, botões de madeira e bolso no peito. Fica linda aberta sobre regata.',
        preco: 7400,
        estoque: 1,
        atributos: { tamanho: 'M', marca: 'Sem marca', estado: 'muito-bom', cor: 'branco', tecido: '100% linho' },
    },
    {
        nome: 'Saia plissada metalizada',
        categoria: 'Saias',
        descricao: 'Plissado fininho com brilho discreto. Peça curinga para festa.',
        preco: 5900,
        estoque: 1,
        atributos: { tamanho: 'P', marca: 'Shoulder', estado: 'nova-com-etiqueta', cor: 'terracota', precoOriginal: '29900' },
    },
    {
        nome: 'Camiseta de banda vintage',
        categoria: 'Camisetas',
        descricao: 'Malha fininha, gola levemente gasta e estampa craquelada. Original de turnê dos anos 2000.',
        preco: 7900,
        estoque: 1,
        atributos: { tamanho: 'G', marca: 'Hanes', estado: 'vintage', cor: 'preto', tecido: '100% algodão', decada: 'anos 2000' },
    },
    {
        nome: 'Sobretudo de lã xadrez',
        categoria: 'Jaquetas & Casacos',
        descricao: 'Forrado, com botões de chifre e comprimento abaixo do joelho. Atemporal.',
        preco: 24900,
        estoque: 1,
        atributos: { tamanho: 'M', marca: 'Richards', estado: 'bom', cor: 'marrom', tecido: '70% lã', medidas: 'Busto 104 cm · Comprimento 108 cm', precoOriginal: '129900', forro: 'sim' },
    },
    {
        nome: 'Shorts jeans cintura alta',
        categoria: 'Shorts',
        descricao: 'Barra desfiada e lavagem média. Cintura alta que valoriza.',
        preco: 4500,
        estoque: 1,
        atributos: { tamanho: '36', marca: 'Hering', estado: 'muito-bom', cor: 'jeans' },
    },
    {
        nome: 'Bota de couro cano curto',
        categoria: 'Calçados',
        descricao: 'Couro legítimo, salto bloco de 4 cm e solado novo.',
        preco: 15900,
        estoque: 1,
        atributos: { tamanho: '37', marca: 'Arezzo', estado: 'muito-bom', cor: 'preto', precoOriginal: '54990' },
    },
    {
        nome: 'Bolsa de palha artesanal',
        categoria: 'Acessórios',
        descricao: 'Trançada à mão, com alça de couro. Cabe tudo para um dia de praia.',
        preco: 6900,
        estoque: 2,
        atributos: { tamanho: 'Único', marca: 'Artesanal', estado: 'nova-com-etiqueta', cor: 'bege' },
    },
    {
        nome: 'Blazer de veludo cotelê',
        categoria: 'Jaquetas & Casacos',
        descricao: 'Verde musgo, ombreiras suaves. Já encontrou um novo lar.',
        preco: 11900,
        estoque: 0,
        atributos: { tamanho: 'P', marca: 'Cantão', estado: 'vintage', cor: 'verde', tecido: 'Veludo cotelê' },
    },
];

async function main() {
    const resposta = await fetch(`${PRODUTOS_URL}/produtos`);
    if (!resposta.ok) {
        throw new Error(`Serviço_Produtos respondeu ${resposta.status} em ${PRODUTOS_URL}`);
    }
    const existentes = new Set((await resposta.json()).map((p) => p.nome));

    let criadas = 0;
    for (const peca of PECAS) {
        if (existentes.has(peca.nome)) {
            console.log(`· já existe: ${peca.nome}`);
            continue;
        }
        const r = await fetch(`${PRODUTOS_URL}/produtos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imagemUrl: '', ...peca }),
        });
        if (!r.ok) {
            throw new Error(`Falha ao criar "${peca.nome}": ${r.status} ${await r.text()}`);
        }
        criadas += 1;
        console.log(`+ criada: ${peca.nome}`);
    }
    console.log(`\n${criadas} peça(s) cadastrada(s).`);
}

main().catch((erro) => {
    console.error(erro.message);
    process.exit(1);
});
