# Coisas a tratar

Lista do que ficou combinado para mais tarde.

- Cada ponto tem um número fixo, para se poder dizer "ponto 7 resolvido".
- Quando um ponto fica feito, sai da lista e o número não volta a ser usado. O histórico fica nos commits.
- Pontos novos recebem o número seguinte ao maior já usado (último usado: 16).

## Funcionalidades

1. **Envio de emails e notificações push.**
   - Alertas de preço (já se criam na conta, mas ainda não enviam nada).
   - Aviso da previsão semanal de preços.
   - Precisa de uma conta Resend (ou outro serviço de email) e de uma conta de serviço do Firebase, guardadas como segredos no GitHub.
   - Ficou para mais tarde por decisão do dono do site.
2. **Caixa de sugestões.**
   - Os pedidos já se gravam em `conta.html#ideas` e veem-se em `admin.html`.
   - Falta definir o que mais é preciso. Por exemplo:
     - aviso por email ao administrador quando chega uma sugestão nova;
     - estado de cada pedido visível para quem o fez.
3. **Verificação semanal das campanhas de desconto.**
   - Uma tarefa agendada que revê as páginas das campanhas e propõe alterações a `data/descontos.json` num pull request, para aprovação.
   - Deve também verificar as campanhas na data em que terminam.

## Descontos por confirmar ou acrescentar

4. **MB WAY UP!** O site tem 5% de cashback na bp, marcado "a confirmar". Falta uma captura ou os termos da campanha na app, para acertar:
   - o mínimo e o máximo por pessoa;
   - a data de fim.
5. **Moeve Gow:** o saldo Gow normal, fora das promoções.
6. **Moeve Gow:** o desconto do cartão DECO PROteste no combustível.
7. **Alves Bandeira (Pontos AB):** os valores são "até 12 / até 6 cênt."; confirmar se são na hora ou em pontos.
8. **Vodafone na Repsol:** confirmar a divisão entre o desconto imediato e o saldo.
9. **Parceiros Repsol sem divisão publicada:** confirmar a divisão. Ageas, Seguro Directo, Santander, Interpass, Benfica, Porto e Sporting contam, por agora, como todo em saldo.
10. **BP:** os valores dos cartões BP Bónus de parceiros (Castrol Service e outros).
11. **BP:** o "desconto local" de cada posto.
12. **BP:** confirmar se o Poupa Mais acumula com o ACP quando se paga com o ACP Master.
13. **Outras marcas,** quando houver ligações: Prio, Intermarché, Shell, Auchan (carregamentos), Pingo Doce (postos próprios), etc.

## Para o dono do site testar (com sessão iniciada)

14. Confirmar que os cartões ficam gravados na conta:
    - com "Já tenho, acrescentar" na ficha do posto;
    - com o painel "Os meus cartões" aberto a partir da ficha.

## Para verificar

16. **Postos escondidos pela DGEG.** Confirmar que a tarefa diária de 27/11 (09:17 UTC) gerou `data/escondidos.json` sem erros no GitHub Actions; até agora foi gerado à mão.
