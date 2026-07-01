# Priority Scheduling

Algoritmo de escalonamento `algorithms::PRIO` implementado em
`schedulers/priority.h` / `schedulers/priority.cc`.

## 1. Ideia geral

O Priority Scheduling escolhe, entre os processos já chegados e ainda não
finalizados, o de **maior prioridade** — nesta implementação, quanto
**menor** o valor do campo `priority`, maior a prioridade (`priority = 1`
é a mais alta). É **preemptivo**: a escolha é reavaliada a cada tick, e um
processo de prioridade mais alta que chegue no meio da execução de outro
pode assumir a CPU.

## 2. Estrutura do algoritmo

Assim como o EDF, o Priority executa **1 unidade de tempo por iteração** do
laço principal e reavalia a escolha a cada tick — mas com uma diferença
importante na forma como trata a troca de contexto.

```cpp
for (int i = 0; i < quantidade_processos; i++) {
    if (finalizado[i]) continue;
    if (p.process_list[i].absolute_arrival_time > tempo) continue;
    if (maior == -1) {
        maior = i;
    } else if (p.process_list[i].priority < p.process_list[maior].priority) {
        maior = i;
    }
}
```

A cada iteração:

1. Busca o processo de maior prioridade entre os já chegados e não
   finalizados;
2. Se nenhum chegou, CPU ociosa por 1 tick;
3. **Detecta preempção** comparando o processo escolhido (`maior`) com o
   que estava rodando na iteração anterior (`processo_atual`);
4. Se houve preempção real, insere `p.overload` ticks de sobrecarga e
   **volta ao topo do laço** sem executar nada nesse ciclo (`continue`);
5. Caso contrário, executa o processo escolhido por 1 tick.

## 3. Detecção de preempção e overload

```cpp
if (processo_atual != -1 &&
    processo_atual != maior &&
    !finalizado[processo_atual]) {
    for (int i = 0; i < p.overload; i++) {
        timeline->push_back(CPUTimeline::OVERLOAD);
        tempo++;
    }
    processo_atual = -1;
    continue; // volta pra busca
}
```

O overload só é cobrado quando as três condições são verdadeiras
simultaneamente:

- Já havia um processo em execução (`processo_atual != -1`);
- O processo escolhido agora é **diferente** do que estava rodando;
- O processo que estava rodando **ainda não terminou** (não foi uma troca
  natural por finalização).

Essa é a mesma filosofia de design usada no EDF: **overload só é cobrado em
preempção real**, nunca quando a CPU troca de processo porque o anterior
concluiu naturalmente, nem quando sai do estado ocioso.

Diferente do EDF (que insere o overload e já continua a execução do
processo escolhido no mesmo ciclo), o Priority usa `continue;` após
inserir o overload — ou seja, o ciclo em que a preempção é detectada **não
executa nenhum processo**, apenas insere a sobrecarga e recomeça a busca no
próximo ciclo. Isso mantém `tempo` e o tamanho da `timeline` sempre
sincronizados (cada tick de tempo corresponde a exatamente uma entrada na
timeline).

## 4. Código completo

```cpp
#include "priority.h"
#include "../internals/handling.h"

void PriorityScheduler::run(const payload &p, std::vector<int> *timeline) {
    int tempo = 0;
    int quantidade_processos = p.process_list.size();
    std::vector<int> restante(quantidade_processos);
    std::vector<bool> finalizado(quantidade_processos, false);
    for (int i = 0; i < quantidade_processos; i++) {
        restante[i] = p.process_list[i].burst_time;
    }

    int processos_finalizados = 0;
    int processo_atual = -1;

    while (processos_finalizados < quantidade_processos) {
        int maior = -1;

        for (int i = 0; i < quantidade_processos; i++) {
            if (finalizado[i]) continue;
            if (p.process_list[i].absolute_arrival_time > tempo) continue;
            if (maior == -1) {
                maior = i;
            } else if (p.process_list[i].priority < p.process_list[maior].priority) {
                maior = i;
            }
        }

        if (maior == -1) {
            timeline->push_back(CPUTimeline::IDLE);
            tempo++;
            processo_atual = -1;
            continue;
        }

        if (processo_atual != -1 &&
            processo_atual != maior &&
            !finalizado[processo_atual]) {
            for (int i = 0; i < p.overload; i++) {
                timeline->push_back(CPUTimeline::OVERLOAD);
                tempo++;
            }
            processo_atual = -1;
            continue;
        }

        timeline->push_back(p.process_list[maior].id);
        tempo++;
        restante[maior]--;
        processo_atual = maior;

        if (restante[maior] == 0) {
            finalizado[maior] = true;
            processos_finalizados++;
            processo_atual = -1;
        }
    }
}
```

## 5. Exemplo de execução

Processos (`overload = 1`, prioridade 1 = mais alta):

| Processo | Chegada | Burst | Prioridade |
|----------|---------|-------|------------|
| P1       | 0       | 5     | 3          |
| P2       | 2       | 3     | 1          |
| P3       | 4       | 2     | 2          |

Traço resultante:

| Tempo  | CPU      | Observação                                             |
|--------|----------|----------------------------------------------------------|
| 0 – 1  | P1       | Único chegado                                             |
| 2      | OVERLOAD | P2 (prioridade 1) chega e preempta P1 → 1 tick de overload |
| 3 – 5  | P2       | Maior prioridade até terminar                             |
| 5      | —        | P2 termina naturalmente (sem overload na troca seguinte)  |
| 6 – 7  | P3       | Entre P1(3) e P3(2), P3 tem prioridade mais alta          |
| 7      | —        | P3 termina                                                |
| 8 – 10 | P1       | Retoma e conclui os 3 ticks restantes                     |

## 6. Integração no projeto

- Enum: `algorithms::PRIO` (já existente em `algorithms.h`).
- Classe: `PriorityScheduler::run(const payload &p, std::vector<int> *timeline)`.
- Chamada em `core.cc`, dentro do `switch (p.algorithm)`.
- Depende de `absolute_arrival_time`, `burst_time` e `priority` do
  `process`, e de `overload` do `payload`.

## 7. Observação sobre `calculate_stats`

Assim como o EDF, o Priority é preemptivo e pode gerar gaps no meio da
execução de um processo (overload de preempção). A fórmula original de
`waiting_time` em `core.cc` (`finish - burst_time`) não desconta o
`absolute_arrival_time` nem os gaps intermediários. A correção recomendada
é a mesma aplicada para o EDF:

```cpp
int ta = finish - p.absolute_arrival_time;
int w  = ta - p.burst_time;
```