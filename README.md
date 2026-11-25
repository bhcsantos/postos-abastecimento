# Postos de Abastecimento

Site para encontrar e comparar postos de abastecimento em Portugal continental, com os preços publicados pela DGEG, e carregadores elétricos da rede MOBI.E com o estado em direto.

**Site:** https://bhcsantos.github.io/postos-abastecimento/

## O que faz

- **Preços em direto.** Sempre que a página abre, o navegador pede os preços à [DGEG — Preços dos Combustíveis](https://precoscombustiveis.dgeg.gov.pt/). Não há servidor nem base de dados próprios.
- **Zonas.** Portugal continental (a zona inicial), qualquer um dos 18 distritos e, dentro de cada distrito, filtros por concelho e por localidade (por exemplo: distrito do Porto → Gondomar → Rio Tinto). Os filtros são caixas de seleção onde se podem marcar várias opções (vários concelhos, várias marcas, várias fichas…).
- **Combustíveis.** Gasóleo simples e especial, gasolina 95 simples e especial, gasolina 98 especial e GPL Auto.
- **Mapa interativo** com os postos agrupados: cada bolinha mostra quantos postos tem e vai-se dividindo à medida que se aproxima o mapa.
- **Lista da zona visível**, ordenada do mais barato para o mais caro ou, com a localização ligada, do mais perto para o mais longe.
- **A minha localização** no mapa, com a distância a cada posto.
- **Ficha de cada posto** (botão "Entrar no posto"): todos os combustíveis e preços, média e posição no concelho, horário, serviços, meios de pagamento, mapa e ligação ao Street View.
- **Carregadores elétricos** (`carregadores.html`): os postos da rede MOBI.E, com filtros por tipo de ficha (Tipo 2, CCS, CHAdeMO), potência mínima, operador e "só com tomada livre agora". O estado de cada tomada (livre, ocupada, fora de serviço) atualiza-se sozinho a cada minuto. Mostra também o preço do operador do posto (com contrato e avulso) e uma estimativa do custo de 20 kWh, para ordenar do mais barato.
- **Cartões de desconto** ("Os meus cartões de desconto"): o utilizador marca os programas que tem (ex.: Vodafone) e a lista mostra o preço na bomba, o preço com desconto direto e o custo efetivo com o saldo em app. As regras estão em `data/descontos.json`, com fonte, validade e estado ("a confirmar" ou "confirmado").
- **Evolução do preço** na ficha de cada posto: gráfico do posto contra a mediana do distrito e a nacional.
- **Contas** (opcionais): login com Google ou email e palavra-passe; perfis por carro (combustível ou fichas, depósito ou bateria, consumo, cartões de desconto), favoritos, casa e trabalho como partida do percurso, alertas de preço e pedidos de funcionalidades.
- **Instalar como app** (PWA): o site pode ser adicionado ao ecrã inicial do telemóvel.
- **O meu percurso.** Junte postos de combustível e carregadores no mesmo percurso, mude a ordem das paragens, veja a distância a partir da sua localização e abra o percurso no Google Maps (até 10 paragens) ou copie a lista.

## Ficheiros

| Ficheiro | Para que serve |
| --- | --- |
| `index.html` | Página principal: mapa, filtros, lista e seleção. Inclui uma cópia dos preços do concelho do Porto (25/11/2026), usada só quando a DGEG não responde. |
| `posto.html` | Ficha de um posto, aberta como `posto.html?id=<número do posto na DGEG>`. |
| `carregadores.html` | Carregadores elétricos da MOBI.E, com estado em direto e preços do operador. |
| `dropdown.js` | Caixas de filtro (combustível, concelho, localidade, marca, ficha, potência, estado, operador), com escolha múltipla e pesquisa nas listas grandes. |
| `route.js` | O percurso partilhado pelas três páginas (guardado no navegador). |
| `worker/mobie-proxy.js` | Código do intermediário (Cloudflare Worker) que corre em `https://mobie-proxy.bhcsantos.workers.dev`. Está no repositório para consulta; não corre no GitHub Pages. |
| `descontos.js`, `data/descontos.json` | Cartões de desconto: o utilizador acrescenta o que tem (pesquisa por nome), o site aplica a melhor combinação em cada posto e explica o que é preciso. Regras com fonte, validade e estado. Repsol: planos My Repsol e 35 cartões de parceiro, a partir de repsol.pt/particulares/beneficios e /parceiros. |
| `scripts/historico.py`, `.github/workflows/historico.yml` | Recolha diária dos preços da DGEG (GitHub Actions, 09:17 UTC) para `data/historico/`. |
| `previsao.js`, `scripts/previsao.py`, `.github/workflows/previsao.yml`, `data/previsao.json` | Previsão de preços da semana seguinte (estimativa do setor das sextas-feiras, recolhida do Ativos.pt), mostrada num aviso no topo da página dos combustíveis. A tarefa corre à sexta à tarde e ao sábado de manhã. |
| `manifest.webmanifest`, `sw.js`, `icons/` | Instalação como app (PWA). |
| `account.js`, `conta.html`, `admin.html`, `privacidade.html` | Contas (Firebase): login Google ou email, perfis, favoritos, casa/trabalho, alertas, pedidos de funcionalidades, exportar/apagar dados; administração dos pedidos; política de privacidade. |
| `data/carros.json`, `data/carros-manual.json`, `scripts/carros.py` | Catálogo de carros para preencher os perfis. Elétricos da [OpenEV Data](https://open-ev-data.github.io) (licença [CDLA-Permissive-2.0](https://cdla.dev/permissive-2-0/)); combustível e híbridos plug-in acrescentados à mão em `carros-manual.json`, cada um com fontes. Gerar com `python scripts/carros.py <pasta do open-ev-data-dataset>`. |
| `firestore.rules` | Regras de acesso à base de dados. Publicar à mão em Firebase → Firestore Database → Regras. |
| `.nojekyll` | Faz o GitHub Pages publicar os ficheiros tal como estão. |

Não há passo de compilação: são páginas HTML com JavaScript, publicadas pelo GitHub Pages a partir do ramo `main`. Qualquer alteração enviada para `main` fica online em 1 a 2 minutos.

## Fontes e bibliotecas

- Preços, horários e serviços: API pública da DGEG (`precoscombustiveis.dgeg.gov.pt/api/PrecoComb`), que aceita pedidos feitos a partir do navegador.
- Carregadores: dados públicos do mapa da [MOBI.E](https://www.mobie.pt/mapa-de-postos) (`data.mobie.pt`). Esse servidor não permite pedidos de outros sites a partir do navegador, por isso passam pelo Worker em `worker/mobie-proxy.js`, que só responde a este site e guarda as respostas em cache (lista de postos e tarifários 1 hora, estado 60 segundos). Estes endereços não são uma API documentada e podem mudar sem aviso.
- Mapa: [Leaflet](https://leafletjs.com/) 1.9.4 e [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) 1.5.3, carregados do cdnjs.
- Mosaicos do mapa: © [colaboradores do OpenStreetMap](https://www.openstreetmap.org/copyright). Os servidores do OpenStreetMap aceitam sites com pouco tráfego; se o site crescer, convém mudar para um fornecedor de mapas com conta própria.

## Limitações

- A DGEG só cobre Portugal continental (sem Açores nem Madeira). A MOBI.E inclui também postos nas ilhas.
- Os preços dos carregadores são só os do operador do posto (cerca de 91% dos postos). O valor final inclui ainda a energia do comercializador (CEME), a taxa da MOBI.E e os impostos.
- Os preços, moradas e localidades são os que os postos comunicam à DGEG e podem ter erros ou atrasos. Confirme sempre o preço no posto.
- A DGEG não publica fotografias dos postos.
- A seleção de postos e a última zona escolhida ficam guardadas só no navegador de quem usa o site.
