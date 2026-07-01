# EDF — Earliest Deadline First

Algoritmo de escalonamento `algorithms::EDF` implementado em
`schedulers/edf.h` / `schedulers/edf.cc`.

## 1. Ideia geral

O EDF escolhe, a cada instante de tempo, o processo **já chegado** e **ainda
não finalizado** que possui o **menor deadline absoluto**
(`absolute_deadline`). É um algoritmo clássico de escalonamento de tempo
real, geralmente usado como referência de otimalidade para sistemas
uniprocessador com deadlines simples (sem dependências entre processos).

Nesta implementação, o EDF é **preemptivo**: a escolha do processo é
reavaliada a cada unidade de tempo, permitindo que um processo com deadline
mais urgente interrompa outro que já estava em execução.

## 2. Estrutura do algoritmo

Diferente do SJF/Priority (que rodam o processo escolhido até o fim do
`burst_time` de uma só vez), o EDF mantém um vetor de **tempo restante** por
processo e executa **1 unidade de tempo por iteração** do laço principal,
reavaliando a escolha a cada tick:

```cpp
std::vector<int> tempo_restante(quantidade_processos);
for (int i = 0; i < quantidade_processos; i++) {
    tempo_restante[i] = p.process_list[i].burst_time;
}
```

A cada iteração do `while`:

1. Percorre todos os processos já chegados (`absolute_arrival_time <=
   tempo`) e ainda não finalizados;
2. Escolhe o de menor `absolute_deadline`;
3. Executa esse processo por 1 tick (`tempo_restante[escolhido]--`);
4. Se o tempo restante chegar a zero, marca o processo como finalizado.

Esse padrão de "1 tick por iteração + reavaliação" é o que garante a
**preempção**: se um processo com deadline mais próximo chegar no meio da
execução de outro, ele assume a CPU já na iteração seguinte, sem precisar
esperar o processo atual terminar.

## 3. CPU ociosa

Se, num determinado tick, nenhum processo já chegou (todos com
`absolute_arrival_time > tempo`), a CPU fica ociosa:

```cpp
if (escolhido == -1) {
    timeline->push_back(CPUTimeline::IDLE);
    tempo++;
    continue;
}
```

## 4. Sobrecarga (overload) por troca de contexto

Como o EDF é preemptivo, ele naturalmente troca de processo em execução com
frequência. Para simular o custo real de uma troca de contexto, o
escalonador guarda o **id do processo que ocupou a CPU no tick anterior**
(`processo_anterior`). Sempre que o processo escolhido muda em relação ao
anterior, `p.overload` ticks de `CPUTimeline::OVERLOAD` são inseridos na
timeline antes de retomar a execução:

```cpp
if (processo_anterior != -1 && processo_anterior != escolhido && p.overload > 0) {
    for (int i = 0; i < p.overload; i++) {
        timeline->push_back(CPUTimeline::OVERLOAD);
        tempo++;
    }
}
```

### Decisão de design: quando o overload é cobrado

O overload só é cobrado quando há **preempção real** — um processo em
andamento é interrompido por outro antes de terminar. Quando um processo
**termina naturalmente** e outro assume a CPU em seguida, `processo_anterior`
é resetado para `-1` nesse instante, então a próxima troca não é penalizada:

```cpp
if (tempo_restante[escolhido] == 0) {
    finalizado[escolhido] = true;
    processos_finalizados++;
    processo_anterior = -1; // término natural não conta como troca de contexto
}
```

> Essa é uma escolha de modelagem, não uma regra universal de EDF. Se o
> enunciado do trabalho exigir que **toda** troca de processo em execução
> gere overload (inclusive quando um processo termina e outro assume
> naturalmente), basta remover a linha `processo_anterior = -1;` do bloco
> acima.

Da mesma forma, quando a CPU fica ociosa, `processo_anterior` também é
resetado — a transição de "ninguém rodando" para "processo X rodando" não é
tratada como troca de contexto:

```cpp
if (escolhido == -1) {
    timeline->push_back(CPUTimeline::IDLE);
    tempo++;
    processo_anterior = -1;
    continue;
}
```

## 5. Código completo

```cpp
#include "edf.h"
#include "../internals/handling.h"

void EDFScheduler::run(const payload &p, std::vector<int> *timeline) {
    int tempo = 0;
    int quantidade_processos = p.process_list.size();

    std::vector<int> tempo_restante(quantidade_processos);
    for (int i = 0; i < quantidade_processos; i++) {
        tempo_restante[i] = p.process_list[i].burst_time;
    }

    std::vector<bool> finalizado(quantidade_processos, false);
    int processos_finalizados = 0;
    int processo_anterior = -1;

    while (processos_finalizados < quantidade_processos) {
        int escolhido = -1;

        for (int i = 0; i < quantidade_processos; i++) {
            if (finalizado[i]) {
                continue;
            }
            if (p.process_list[i].absolute_arrival_time > tempo) {
                continue;
            }
            if (escolhido == -1) {
                escolhido = i;
            } else if (p.process_list[i].absolute_deadline <
                       p.process_list[escolhido].absolute_deadline) {
                escolhido = i;
            }
        }

        if (escolhido == -1) {
            timeline->push_back(CPUTimeline::IDLE);
            tempo++;
            processo_anterior = -1;
            continue;
        }

        if (processo_anterior != -1 &&
            processo_anterior != escolhido &&
            p.overload > 0) {
            for (int i = 0; i < p.overload; i++) {
                timeline->push_back(CPUTimeline::OVERLOAD);
                tempo++;
            }
        }

        timeline->push_back(p.process_list[escolhido].id);
        tempo_restante[escolhido]--;
        tempo++;
        processo_anterior = escolhido;

        if (tempo_restante[escolhido] == 0) {
            finalizado[escolhido] = true;
            processos_finalizados++;
            processo_anterior = -1;
        }
    }
}
```

## 6. Exemplo de execução

Processos (`overload = 1`):

| Processo | Chegada | Burst | Deadline |
|----------|---------|-------|----------|
| P1       | 0       | 5     | 12       |
| P2       | 2       | 3     | 10       |
| P3       | 4       | 2     | 15       |
| P4       | 6       | 4     | 18       |

Traço resultante:

| Tempo   | CPU        | Observação                                        |
|---------|-----------|----------------------------------------------------|
| 0 – 1   | P1         | Único processo chegado                              |
| 2       | (troca)    | P2 chega com deadline 10 < 12 → preempta P1         |
| 2 – 3   | OVERLOAD   | Custo de troca de contexto (preempção real)         |
| 3 – 5   | P2         | Continua sendo o menor deadline até terminar        |
| 5       | —          | P2 termina                                          |
| 6 – 8   | P1         | Retoma execução (nenhuma troca com overload — término natural) |
| 8       | —          | P1 termina                                          |
| 9 – 10  | P3         | Menor deadline entre P3(15) e P4(18)                |
| 10      | —          | P3 termina                                          |
| 11 – 14 | P4         | Único processo restante                             |

Note que só existe **uma única sobrecarga** em toda a simulação — exatamente
no ponto em que P2 interrompe P1 ainda em execução. As demais trocas de
processo (P2→P1, P1→P3, P3→P4) ocorrem porque o processo anterior **terminou
naturalmente**, então, pela regra de modelagem adotada (seção 4), não geram
overload.

## 7. Cálculo de métricas (`calculate_stats` em `core.cc`)

Por ser preemptivo, o EDF pode gerar gaps (ociosidade e/ou overload) no meio
da execução de um mesmo processo. Isso torna a fórmula original de
`waiting_time` em `core.cc` imprecisa para este algoritmo:

```cpp
// fórmula original — não desconta arrival_time nem gaps intermediários
int w = finish - p.burst_time;
```

A fórmula recomendada, coerente com o `turnaround_time` já calculado
corretamente, é:

```cpp
int ta = finish - p.absolute_arrival_time;
int w  = ta - p.burst_time; // waiting = turnaround - tempo de execução
```

Essa correção é necessária para que os resultados do EDF (e de qualquer
outro algoritmo preemptivo, como o `CUSTOM`/HDFS) fiquem consistentes.

## 8. Integração no projeto

- Enum: `algorithms::EDF` (já existente em `algorithms.h`).
- Classe: `EDFScheduler::run(const payload &p, std::vector<int> *timeline)`.
- Chamada em `core.cc`, dentro do `switch (p.algorithm)`.
- Depende do campo `absolute_deadline` em `process` (`internals/payload.h`),
  já populado por `payload_from_json` a partir do campo `deadline` recebido
  no JSON do front-end.
- Depende do campo `overload` em `payload` para o custo de troca de
  contexto.