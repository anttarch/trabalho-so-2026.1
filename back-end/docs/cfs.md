# CFS — Completely Fair Scheduler (simulação)

Algoritmo de escalonamento `algorithms::CFS` implementado em
`schedulers/cfs.h` / `schedulers/cfs.cc`.

## 1. Ideia geral

Simula o comportamento do escalonador **CFS do Linux**, baseado no conceito
de **vruntime** (tempo de execução virtual): a cada instante, a CPU é dada
ao processo com o **menor vruntime acumulado** entre os já chegados e não
finalizados. Diferente do Priority/EDF (onde a prioridade é um valor fixo
comparado diretamente), aqui o campo `priority` funciona como um **peso**
que determina a *velocidade* com que o vruntime de cada processo cresce.

## 2. Estrutura de dados

```cpp
typedef struct {
    std::vector<process>::iterator p;
    float vtime;
    bool done;
} _vruntime;
```

Cada processo ativo no sistema tem uma entrada em `vruntime` com seu
vruntime atual (`vtime`). A cada tick, o vetor é ordenado
(`compareVruntime`) e o processo na posição `[0]` é o que deveria estar
rodando:

```cpp
bool compareVruntime(const _vruntime &a, const _vruntime &b) {
    if (a.done != b.done) return !a.done;
    return a.vtime < b.vtime;
}
```

## 3. Peso da prioridade no crescimento do vruntime

A cada tick em que um processo executa, seu vruntime cresce:

```cpp
it->vtime += std::powf(1.25, ps->priority - 1);
```

| Prioridade | Multiplicador (`1.25^(priority-1)`) | Efeito                          |
|------------|--------------------------------------|----------------------------------|
| 1          | 1.00                                  | Cresce no mesmo ritmo do tempo real — recebe mais CPU |
| 2          | 1.25                                  | Cresce mais rápido — recebe menos CPU                  |
| 3          | 1.5625                                | Cresce ainda mais rápido — recebe ainda menos CPU     |

Ou seja: quanto **maior** o número de `priority` (prioridade "pior", no
mesmo padrão usado no Priority Scheduler, onde 1 é o mais importante), mais
rápido o vruntime desse processo cresce, fazendo com que ele ultrapasse os
demais mais cedo e perca a CPU com mais frequência. Isso é o análogo do
conceito de *nice value* no CFS real do Linux.

## 4. Fluxo do algoritmo

1. Os processos são ordenados por `absolute_arrival_time` numa cópia local
   (`p_list`), e colocados numa fila auxiliar `q`;
2. A cada tick, se o processo na frente da fila chegou (`arrival_time ==
   time`), ele é adicionado ao vetor `vruntime` com `vtime` inicial igual
   ao tempo atual (`(float)time`) — isso evita que processos novos
   comecem com vantagem injusta sobre os que já estão rodando há tempo;
3. Se o vetor `vruntime` não está vazio, ele é ordenado; se o processo com
   menor vruntime **não** é o que está rodando atualmente (`ps`), ocorre
   uma **troca de contexto**: insere `p.overload` ticks de `OVERLOAD` e
   atualiza `ps` para o novo processo escolhido;
4. Se o processo com menor vruntime **já é** o que está rodando, ele
   executa por 1 tick: decrementa `burst_time`, registra o `id` na
   timeline, incrementa o `vtime`, e remove da lista se `burst_time`
   chegar a zero;
5. Se `vruntime` está vazio (nenhum processo chegou ainda), CPU ociosa.

## 5. ⚠️ Limitações e bugs conhecidos

Ao contrário do SJF/Priority/EDF (que já estavam consistentes), o CFS como
está implementado tem **dois problemas reais** que vale a pena corrigir ou
pelo menos documentar antes de usar em produção/nota:

### 5.1 Chegadas simultâneas são perdidas

```cpp
if (!q.empty() && q.front()->absolute_arrival_time == time) {
    ...
    q.pop();
}
```

Esse `if` verifica **apenas o primeiro** elemento da fila por tick. Se dois
ou mais processos tiverem o **mesmo** `absolute_arrival_time`, apenas o
primeiro é adicionado ao `vruntime` nesse tick — o segundo (e os demais com
o mesmo horário de chegada) **nunca serão adicionados**, porque na próxima
iteração `time` já avançou, e a condição `q.front()->absolute_arrival_time
== time` deixa de ser verdadeira para sempre (já que `arrival_time` do
próximo da fila continua sendo o valor antigo, menor que o novo `time`).
Isso significa que **processos com chegada simultânea a outro processo são
descartados silenciosamente da simulação**.

**Correção sugerida:** trocar o `if` por um `while`, para tratar todos os
processos que chegaram naquele tick, não apenas o primeiro:

```cpp
while (!q.empty() && q.front()->absolute_arrival_time == time) {
    if (vruntime.empty()) ps = q.front();
    _vruntime v = {.p = q.front(), .vtime = (float)time};
    vruntime.emplace_back(v);
    q.pop();
}
```

### 5.2 `tempo` e o tamanho da `timeline` ficam dessincronizados no overload

```cpp
if (p.overload) {
    std::fill_n(timeline_end, p.overload, CPUTimeline::OVERLOAD);
}
ps = vruntime[0].p;
```

Aqui, `p.overload` entradas são inseridas na timeline de uma vez, mas a
variável `time` (usada para checar chegadas de processos e para o `vtime`
inicial de novos processos) só é incrementada **uma vez** no final do
laço (`time++`), independentemente de quantos ticks de overload foram
inseridos. Isso é diferente do EDF e do Priority, que incrementam `tempo`
dentro do próprio laço de inserção de overload, mantendo a timeline
sincronizada com o tempo simulado.

Consequência prática: se `p.overload > 1`, a `timeline` fica **maior** do
que o `time` simulado sugere, e processos que deveriam chegar durante esse
intervalo de sobrecarga podem ser posicionados incorretamente na timeline
(a checagem de chegada usa `time`, que não reflete o tamanho real da
timeline nesse ponto).

**Correção sugerida:** incrementar `time` dentro do próprio laço de
inserção de overload, assim como é feito no EDF/Priority:

```cpp
if (p.overload) {
    for (int i = 0; i < p.overload; i++) {
        timeline.emplace_back(CPUTimeline::OVERLOAD);
        time++;
    }
}
ps = vruntime[0].p;
```

(Isso exige remover o `time++` incondicional do fim do laço nesse caminho
específico, ou reestruturar o fluxo para não incrementar duas vezes —
requer atenção ao adaptar.)

### 5.3 Overload não é cobrado em transições vindas do estado ocioso

Assim como no EDF e no Priority, quando o primeiro processo começa a rodar
vindo de um estado sem nenhum processo em `vruntime`, não há cobrança de
overload — isso é intencional e consistente com o restante do projeto (só
se cobra troca de contexto entre processos, não a saída da ociosidade).

## 6. Código original (como enviado)

```cpp
#include "cfs.h"
#include <algorithm>
#include <cmath>
#include <iterator>
#include <queue>
#include <vector>
#include "../internals/handling.h"

typedef struct {
    std::vector<process>::iterator p;
    float vtime;
    bool done;
} _vruntime;

bool compareArrivalTime(const process &a, const process &b) {
    return a.absolute_arrival_time < b.absolute_arrival_time;
}

bool compareVruntime(const _vruntime &a, const _vruntime &b) {
    if (a.done != b.done) return !a.done;
    return a.vtime < b.vtime;
}

void CFSScheduler::run(const payload &p, std::vector<int> *t) {
    std::vector<int> timeline;
    auto timeline_end = std::back_inserter(timeline);

    std::vector<process> p_list = p.process_list;
    std::sort(p_list.begin(), p_list.end(), compareArrivalTime);

    std::queue<std::vector<process>::iterator> q;
    for (auto it = p_list.begin(); it < p_list.end(); it++) q.push(it);

    std::vector<_vruntime> vruntime;
    int done = 0;
    int time = 0;
    std::vector<process>::iterator ps;

    while (done < p_list.size()) {
        if (!q.empty() && q.front()->absolute_arrival_time == time) {
            if (vruntime.empty()) ps = q.front();
            _vruntime v = {.p = q.front(), .vtime = (float)time};
            vruntime.emplace_back(v);
            q.pop();
        }

        if (!vruntime.empty()) {
            std::sort(vruntime.begin(), vruntime.end(), compareVruntime);

            if (vruntime[0].p->id != ps->id) {
                if (p.overload) {
                    std::fill_n(timeline_end, p.overload, CPUTimeline::OVERLOAD);
                }
                ps = vruntime[0].p;
            } else {
                ps->burst_time--;
                timeline.emplace_back(ps->id);
                for (auto it = vruntime.begin(); it < vruntime.end(); it++) {
                    if (it->p->id == ps->id) {
                        it->vtime += std::powf(1.25, ps->priority - 1);
                        if (!ps->burst_time) {
                            done++;
                            vruntime.erase(it);
                        }
                        break;
                    }
                }
            }
        } else {
            timeline.emplace_back(CPUTimeline::IDLE);
        }
        time++;
    }
    *t = timeline;
}
```

## 7. Exemplo de execução (ilustrativo, com `overload = 1`)

Processos:

| Processo | Chegada | Burst | Prioridade |
|----------|---------|-------|------------|
| P1       | 0       | 4     | 1          |
| P2       | 1       | 4     | 2          |

- `t=0`: P1 chega, `vruntime = [P1: 0]`. `ps = P1`. P1 executa (menor
  vruntime é ele mesmo). `vtime(P1) = 0 + 1.25^0 = 1`.
- `t=1`: P2 chega, `vruntime = [P1: 1, P2: 1]` (P2 entra com `vtime =
  time = 1`). Ordena — empate; a ordem de desempate depende da
  estabilidade do `std::sort` (não é estável por padrão, então o resultado
  pode variar). Supondo que P1 continue à frente: P1 executa novamente,
  `vtime(P1) = 1 + 1 = 2`.
- `t=2`: `vruntime = [P2: 1, P1: 2]`. P2 tem menor vruntime e **não** é
  quem está rodando (`ps` ainda é P1) → **troca de contexto**: insere
  `p.overload` ticks de OVERLOAD, `ps = P2`.
- `t=3`: Reavalia — agora `vruntime[0].p->id == ps->id` (P2) → P2 executa.
  `vtime(P2) = 1 + 1.25^1 = 2.25`.
- E assim por diante, alternando conforme o vruntime de cada um cresce —
  P2, por ter prioridade "pior" (2), tem seu vruntime crescendo mais
  rápido a cada execução, então tende a ceder a CPU de volta para P1 com
  mais frequência ao longo da simulação.

## 8. Integração no projeto

- Enum: `algorithms::CFS` (já existente em `algorithms.h`).
- Classe: `CFSScheduler::run(const payload &p, std::vector<int> *t)`.
- **Atenção:** no `core.cc` original havia um `case algorithms::CFS: //
  TODO` **sem `break;`**, causando fallthrough para o `case
  algorithms::CUSTOM` seguinte. Ao ativar o CFS de fato, é obrigatório
  garantir que o `case CFS` tenha seu próprio `break;`:

```cpp
case algorithms::CFS:
    CFSScheduler::run(p, &result.timeline);
break;
case algorithms::CUSTOM:
    CustomScheduler::run(p, &result.timeline);
break;
```

- Depende de `absolute_arrival_time`, `burst_time` e `priority` do
  `process`, e de `overload` do `payload`.
- Antes de usar em avaliação, recomenda-se aplicar ao menos a correção do
  item 5.1 (chegadas simultâneas), pois ela pode causar processos
  "sumindo" da simulação silenciosamente — um erro difícil de perceber sem
  olhar o código.