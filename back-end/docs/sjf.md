# SJF — Shortest Job First

Algoritmo de escalonamento `algorithms::SJF` implementado em
`schedulers/sjf.h` / `schedulers/sjf.cc`.

## 1. Ideia geral

O SJF escolhe, entre os processos já chegados e ainda não finalizados, o
que possui o **menor `burst_time`** (tempo total de execução). É um
algoritmo **não-preemptivo**: uma vez escolhido, o processo roda até o fim
sem ser interrompido, mesmo que um processo mais curto chegue no meio da
sua execução.

## 2. Estrutura do algoritmo

```cpp
for (int i = 0; i < quantidade_processos; i++) {
    if (finalizado[i]) continue;
    if (p.process_list[i].absolute_arrival_time > tempo) continue;
    if (escolhido == -1) {
        escolhido = i;
    } else if (p.process_list[i].burst_time < p.process_list[escolhido].burst_time) {
        escolhido = i;
    }
}
```

A cada "rodada" do `while` externo:

1. Percorre todos os processos já chegados e não finalizados;
2. Escolhe o de menor `burst_time` (em caso de empate, mantém o primeiro
   encontrado — desempate por ordem de índice, não por chegada);
3. Se nenhum processo chegou ainda, a CPU fica ociosa por 1 tick;
4. Se um processo foi escolhido, ele roda **do início ao fim** de uma vez,
   em um `for` interno que empurra o `id` do processo na timeline
   `burst_time` vezes seguidas:

```cpp
for (int i = 0; i < p.process_list[escolhido].burst_time; i++) {
    timeline->push_back(p.process_list[escolhido].id);
    tempo++;
}
finalizado[escolhido] = true;
processos_finalizados++;
```

Isso é o que torna o algoritmo não-preemptivo: entre o início e o fim desse
`for`, nenhum outro processo é considerado, mesmo que chegue com um
`burst_time` menor nesse intervalo.

## 3. Limitações conhecidas

- **Overload não é considerado.** O código não faz nenhuma referência a
  `p.overload`. Isso é coerente com o fato de o algoritmo ser
  não-preemptivo (não há preempção no meio da execução de um processo), mas
  também significa que **a troca entre um processo e o próximo** (quando um
  termina e outro começa) não gera nenhum custo de troca de contexto na
  timeline. Se o trabalho exigir isso, seria necessário inserir
  `p.overload` ticks de `CPUTimeline::OVERLOAD` entre a finalização de um
  processo e o início do próximo (exceto quando a CPU estava ociosa).
- **Desempate por índice, não por ordem de chegada.** Quando dois processos
  têm o mesmo `burst_time` e já chegaram, o primeiro encontrado na
  iteração (que segue a ordem do `process_list` original, não a ordem de
  chegada) é escolhido. Na prática, costuma coincidir com a ordem de
  chegada se a lista de entrada já vier ordenada, mas não há garantia
  disso no código.

## 4. Código completo

```cpp
#include "sjf.h"
#include "../internals/handling.h"

void SJFScheduler::run(const payload &p, std::vector<int> *timeline) {
    int tempo = 0;
    int quantidade_processos = p.process_list.size();
    std::vector<bool> finalizado(quantidade_processos, false);
    int processos_finalizados = 0;

    while (processos_finalizados < quantidade_processos) {
        int escolhido = -1;

        for (int i = 0; i < quantidade_processos; i++) {
            if (finalizado[i]) continue;
            if (p.process_list[i].absolute_arrival_time > tempo) continue;
            if (escolhido == -1) {
                escolhido = i;
            } else if (p.process_list[i].burst_time < p.process_list[escolhido].burst_time) {
                escolhido = i;
            }
        }

        if (escolhido == -1) {
            timeline->push_back(CPUTimeline::IDLE);
            tempo++;
            continue;
        }

        for (int i = 0; i < p.process_list[escolhido].burst_time; i++) {
            timeline->push_back(p.process_list[escolhido].id);
            tempo++;
        }
        finalizado[escolhido] = true;
        processos_finalizados++;
    }
}
```

## 5. Exemplo de execução

Processos:

| Processo | Chegada | Burst |
|----------|---------|-------|
| P1       | 0       | 6     |
| P2       | 2       | 2     |
| P3       | 3       | 4     |

Traço resultante:

| Tempo  | CPU | Observação                                                  |
|--------|-----|--------------------------------------------------------------|
| 0 – 5  | P1  | Único chegado em t=0; roda os 6 ticks completos sem parar     |
| 6 – 7  | P2  | Entre P2(2) e P3(4), P2 tem o menor burst → escolhido         |
| 8 – 11 | P3  | Único restante                                                |

Note que **P2 e P3 já haviam chegado** (em t=2 e t=3) enquanto P1 ainda
executava (até t=5), mas nenhum deles interrompe P1 — característica
central do SJF não-preemptivo.

## 6. Integração no projeto

- Enum: `algorithms::SJF` (já existente em `algorithms.h`).
- Classe: `SJFScheduler::run(const payload &p, std::vector<int> *timeline)`.
- Chamada em `core.cc`, dentro do `switch (p.algorithm)`.
- Depende apenas de `absolute_arrival_time` e `burst_time` do `process`.