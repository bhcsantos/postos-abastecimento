# Coisas a tratar

Lista do que ficou combinado para mais tarde.

- Cada ponto tem um número fixo, para se poder dizer "ponto 7 resolvido".
- Quando um ponto fica feito, sai da lista e o número não volta a ser usado. O histórico fica nos commits.
- Pontos novos recebem o número seguinte ao maior já usado (último usado: 18).

## Funcionalidades

1. **Emails e notificações push — falta o dono do site ligar o serviço.** O código está feito (`scripts/notificacoes.py`, a cada 30 min). Falta:
   - publicar as regras novas (`firestore.rules`, campos `previsao` e `push`);
   - criar a palavra-passe de aplicação do Gmail;
   - guardar no GitHub os segredos `FIREBASE_SERVICE_ACCOUNT`, `GMAIL_USER` e `GMAIL_APP_PASSWORD`;
   - testar um alerta, a previsão e um pedido de funcionalidade (inclui o ponto 2: aviso ao administrador de pedidos novos e aviso a quem pediu quando o estado muda).

## Descontos por confirmar ou acrescentar

6. **Moeve Gow:** o desconto do cartão DECO PROteste no combustível.
7. **Alves Bandeira (Pontos AB):** os valores são "até 12 / até 6 cênt."; confirmar se são na hora ou em pontos.
8. **Vodafone na Repsol:** confirmar a divisão entre o desconto imediato e o saldo.
9. **Parceiros Repsol sem divisão publicada:** confirmar a divisão. Ageas, Seguro Directo, Santander, Interpass, Benfica, Porto e Sporting contam, por agora, como todo em saldo.
10. **BP:** os valores dos cartões BP Bónus de parceiros (Castrol Service e outros).
11. **BP:** o "desconto local" de cada posto.
12. **BP:** confirmar se o Poupa Mais acumula com o ACP quando se paga com o ACP Master.
13. **Outras marcas,** quando houver ligações: Prio, Intermarché, Shell, Auchan (carregamentos), Pingo Doce (postos próprios), etc. Já feitas: Moeve e Petroprix.

