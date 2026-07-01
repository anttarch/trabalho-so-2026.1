# HDFS — Hybrid Dynamic Feedback Scheduler

Algoritmo de escalonamento customizado (`algorithms::CUSTOM`) implementado em
`schedulers/custom.h` / `schedulers/custom.cc`.

## 1. Motivação

O HDFS é um escalonador híbrido inspirado em **Multilevel Feedback Queue
(MLFQ)**. A ideia é combinar:

- **Baixo tempo de resposta** para processos curtos (comportamento parecido
  com Round Robin de quantum pequeno);
- **Justiça a longo prazo** para processos longos, evitando que eles fiquem
  presos numa fila de baixa prioridade indefinidamente (starvation).

## 2. Estrutura de filas

O escalonador mantém **três filas de prioridade**, dispostas em hierarquia
estrita (a fila 1 só é ignorada se estiver vazia, e assim por diante):

| Fila | Prioridade | Política             | Quantum                    |
|------|-----------|-----------------------|-----------------------------|
| 1    | Alta      | Round Robin           | `p.quantum`                 |
| 2    | Média     | Round Robin           | `2 * p.quantum`             |
| 3    | Baixa     | SJF (não-preemptivo)  | roda até o processo terminar |

Todo processo **entra sempre na fila 1** no momento em que chega
(`absolute_arrival_time <= tempo`).

## 3. Regras de transição (rebaixamento)

Se um processo consome todo o seu quantum sem terminar, ele é **rebaixado**:

- Fila 1 → Fila 2 (dobra o quantum);
- Fila 2 → Fila 3 (passa a ser escalonado por SJF, sem quantum fixo);
- Fila 3 nunca rebaixa mais — já é a fila mais baixa, e por ser não-preemptiva
  ele sempre termina quando é escolhido, então nunca "estoura" quantum nessa
  fila.

Se o processo **termina** dentro do seu quantum (em qualquer fila), ele
simplesmente sai do sistema — não há rebaixamento nem promoção nesse caso.

## 4. Anti-starvation (envelhecimento)

A cada tick de simulação, todo processo que está **esperando** (não
executando) nas filas 2 ou 3 acumula um contador de espera. Ao atingir o
limiar `AGING_THRESHOLD = 20` ticks sem rodar, o processo é **promovido
imediatamente para a fila 1**, com o contador zerado.

Isso garante que processos longos (que tendem a cair para a fila 3) não
fiquem famintos caso o sistema receba um fluxo constante de processos curtos
entrando pela fila 1.

> O valor de `AGING_THRESHOLD` está fixo em 20 no código. Se o trabalho
> exigir que esse valor seja configurável via payload, adicionar um campo
> novo em `payload.h`/`payload.cc` e substituir a constante pela leitura
> desse campo.

## 5. Sobrecarga (overload)

Assim como no EDF, toda vez que a CPU passa a executar um processo diferente
do que rodou no tick anterior, é cobrado `p.overload` ticks de
`CPUTimeline::OVERLOAD` antes da execução começar — simulando o custo de
troca de contexto.

## 6. Complexidade

Por tick de simulação:
- Verificação de chegada de processos: O(n)
- Envelhecimento (filas 2 e 3): O(tamanho da fila 2 + fila 3)
- Seleção de processo na fila 3 (SJF): O(tamanho da fila 3)

Como o laço principal roda uma vez por unidade de tempo até o fim da
simulação, a complexidade total é O(tempo_total_de_simulação × n) no pior
caso — suficiente para os tamanhos de entrada esperados no trabalho.

## 7. Exemplo de execução

Processos (quantum = 4, overload = 1):

| Processo | Chegada | Burst |
|----------|---------|-------|
| P1       | 0       | 6     |
| P2       | 1       | 3     |
| P3       | 2       | 10    |

- `t=0`: P1 chega → fila 1. Executa (quantum 4).
- `t=1`: P2 chega → fila 1 (entra atrás, continua executando P1).
- `t=2`: P3 chega → fila 1.
- `t=4`: P1 esgota quantum (rodou 4 de 6) → rebaixado para fila 2. CPU troca
  para P2 (fila 1) → cobra overload antes de iniciar P2.
- P2 termina em 3 ticks (não precisa dos 4 do quantum).
- CPU passa para P3 (fila 1, quantum 4) → overload novamente.
- P3 esgota quantum (rodou 4 de 10) → rebaixado para fila 2.
- Fila 1 vazia → CPU pega P1 da fila 2 (quantum 8, restam 2) → termina.
- Fila 1 e 2 vazias (exceto P3) → CPU pega P3 da fila 2 (quantum 8, restam
  6) → termina.

Esse é apenas um traço ilustrativo; o comportamento exato de troca de fila
depende dos parâmetros reais de `quantum` e `overload` enviados no payload.

## 8. Integração no projeto

- Enum: `algorithms::CUSTOM` (já existente em `algorithms.h`).
- Classe: `CustomScheduler::run(const payload &p, std::vector<int> *timeline)`.
- Chamada em `core.cc`, dentro do `switch (p.algorithm)`.
- **Correção aplicada**: o `case algorithms::CFS` estava sem `break;`,
  causando fallthrough direto para `case algorithms::CUSTOM`. Isso foi
  corrigido — agora cada `case` tem seu próprio `break`.