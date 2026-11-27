# Coisas a tratar

Lista do que ficou combinado para mais tarde. Quando um ponto fica feito, sai da lista; o histórico fica nos commits.

## Funcionalidades

- **Envio de emails e notificações push.**
  - Alertas de preço (já se criam na conta, mas ainda não enviam nada).
  - Aviso da previsão semanal de preços.
  - Precisa de uma conta Resend (ou outro serviço de email) e de uma conta de serviço do Firebase, guardadas como segredos no GitHub. Ficou para mais tarde por decisão do dono do site.
- **Caixa de sugestões.**
  - Os pedidos já se gravam em `conta.html#ideas` e veem-se em `admin.html`.
  - Falta definir o que mais é preciso. Por exemplo:
    - aviso por email ao administrador quando chega uma sugestão nova;
    - estado de cada pedido visível para quem o fez.
- **Verificação semanal das campanhas de desconto.**
  - Uma tarefa agendada que revê as páginas das campanhas e propõe alterações a `data/descontos.json` num pull request, para aprovação.
  - Deve também verificar as campanhas na data em que terminam.

## Descontos por confirmar ou acrescentar

- **MB WAY UP!** O site tem 5% de cashback na bp, marcado "a confirmar". Falta uma captura ou os termos da campanha na app, para acertar:
  - o mínimo e o máximo por pessoa;
  - a data de fim.
- **Moeve Gow.**
  - Falta o saldo Gow normal, fora das promoções.
  - Falta o desconto do cartão DECO PROteste no combustível.
- **Alves Bandeira (Pontos AB).** Os valores são "até 12 / até 6 cênt.". Falta confirmar se são na hora ou em pontos.
- **Vodafone na Repsol.** Confirmar a divisão entre o desconto imediato e o saldo.
- **Parceiros Repsol sem divisão publicada.** Ageas, Seguro Directo, Santander, Interpass, Benfica, Porto e Sporting contam como todo em saldo; falta confirmar.
- **BP.**
  - Os valores dos cartões BP Bónus de parceiros (Castrol Service e outros).
  - O "desconto local" de cada posto.
  - Se o Poupa Mais acumula com o ACP quando se paga com o ACP Master.
- **Outras marcas** quando houver ligações: Prio, Intermarché, Shell, Auchan (carregamentos), Pingo Doce (postos próprios), etc.

## Para o dono do site testar

- Com sessão iniciada:
  - confirmar que "Já tenho, acrescentar" na ficha do posto fica gravado nos cartões da conta;
  - confirmar o mesmo para o painel "Os meus cartões" aberto a partir da ficha;
  - confirmar no telemóvel que o topo (Cartões, perfil do carro e conta) fica em duas linhas arrumadas.

## Para verificar

- **Postos escondidos pela DGEG.** Confirmar que a tarefa diária de 27/11 (09:17 UTC) gerou `data/escondidos.json` sem erros no GitHub Actions; até agora foi gerado à mão.
