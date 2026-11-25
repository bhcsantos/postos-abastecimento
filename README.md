# Postos de Abastecimento

Site para encontrar e comparar postos de abastecimento em Portugal continental, com os preços publicados pela DGEG, e carregadores elétricos da rede MOBI.E com o estado em direto.

**Site:** https://bhcsantos.github.io/postos-abastecimento/

## O que faz

- **Preços em direto.** Sempre que a página abre, o navegador pede os preços à [DGEG — Preços dos Combustíveis](https://precoscombustiveis.dgeg.gov.pt/). Não há servidor nem base de dados próprios.
- **Zonas.** Portugal continental (a zona inicial), qualquer um dos 18 distritos e, dentro de cada distrito, filtros por concelho e por localidade (por exemplo: distrito do Porto → Gondomar → Rio Tinto).
- **Combustíveis.** Gasóleo simples e especial, gasolina 95 simples e especial, gasolina 98 especial e GPL Auto.
- **Mapa interativo** com os postos agrupados: cada bolinha mostra quantos postos tem e vai-se dividindo à medida que se aproxima o mapa.
- **Lista da zona visível**, ordenada do mais barato para o mais caro ou, com a localização ligada, do mais perto para o mais longe.
- **A minha localização** no mapa, com a distância a cada posto.
- **Ficha de cada posto** (botão "Entrar no posto"): todos os combustíveis e preços, média e posição no concelho, horário, serviços, meios de pagamento, mapa e ligação ao Street View.
- **Carregadores elétricos** (`carregadores.html`): os postos da rede MOBI.E, com filtros por tipo de ficha (Tipo 2, CCS, CHAdeMO), potência mínima, operador e "só com tomada livre agora". O estado de cada tomada (livre, ocupada, fora de serviço) atualiza-se sozinho a cada minuto.
- **Seleção e percurso.** Escolha vários postos e abra o percurso no Google Maps, ou copie a lista.

## Ficheiros

| Ficheiro | Para que serve |
| --- | --- |
| `index.html` | Página principal: mapa, filtros, lista e seleção. Inclui uma cópia dos preços do concelho do Porto (25/11/2026), usada só quando a DGEG não responde. |
| `posto.html` | Ficha de um posto, aberta como `posto.html?id=<número do posto na DGEG>`. |
| `carregadores.html` | Carregadores elétricos da MOBI.E, com estado em direto. |
| `worker/mobie-proxy.js` | Intermediário (Cloudflare Worker) publicado em `https://mobie-proxy.bhcsantos.workers.dev`. Não é publicado pelo GitHub Pages. |
| `.nojekyll` | Faz o GitHub Pages publicar os ficheiros tal como estão. |

Não há passo de compilação: são páginas HTML com JavaScript, publicadas pelo GitHub Pages a partir do ramo `main`. Qualquer alteração enviada para `main` fica online em 1 a 2 minutos.

## Fontes e bibliotecas

- Preços, horários e serviços: API pública da DGEG (`precoscombustiveis.dgeg.gov.pt/api/PrecoComb`), que aceita pedidos feitos a partir do navegador.
- Carregadores: dados públicos do mapa da [MOBI.E](https://www.mobie.pt/mapa-de-postos) (`data.mobie.pt`). Esse servidor não permite pedidos de outros sites a partir do navegador, por isso passam pelo Worker em `worker/mobie-proxy.js`, que só responde a este site e guarda as respostas em cache (lista de postos 1 hora, estado 60 segundos). Estes endereços não são uma API documentada e podem mudar sem aviso.
- Mapa: [Leaflet](https://leafletjs.com/) 1.9.4 e [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) 1.5.3, carregados do cdnjs.
- Mosaicos do mapa: © [colaboradores do OpenStreetMap](https://www.openstreetmap.org/copyright). Os servidores do OpenStreetMap aceitam sites com pouco tráfego; se o site crescer, convém mudar para um fornecedor de mapas com conta própria.

## Limitações

- A DGEG só cobre Portugal continental (sem Açores nem Madeira). A MOBI.E inclui também postos nas ilhas.
- A MOBI.E só publica preços de carregamento de alguns operadores.
- Os preços, moradas e localidades são os que os postos comunicam à DGEG e podem ter erros ou atrasos. Confirme sempre o preço no posto.
- A DGEG não publica fotografias dos postos.
- A seleção de postos e a última zona escolhida ficam guardadas só no navegador de quem usa o site.
