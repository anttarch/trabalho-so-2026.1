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
    if(a.done != b.done) return !a.done;
    return a.vtime < b.vtime;
}

void CFSScheduler::run(const payload &p, std::vector<int> *t) {
    std::vector<int> timeline;
    auto timeline_end = std::back_inserter(timeline);

    // ordena os processos por ordem de chegada
    std::vector<process> p_list = p.process_list;
    std::sort(p_list.begin(), p_list.end(), compareArrivalTime);

    // fila auxiliar para a simular a entrada dos processos
    std::queue<std::vector<process>::iterator> q;
    for (auto it = p_list.begin(); it < p_list.end(); it++) q.push(it);

    // vetor com os dados do vruntime
    std::vector<_vruntime> vruntime;

    // qtd de processos finalizados
    int done = 0;

    int time = 0;
    std::vector<process>::iterator ps;
    while (done < p_list.size()) {

        // adiciona um processo novo a lógica do vruntime
        if (!q.empty() && q.front()->absolute_arrival_time == time) {
            // se ainda não haver processo rodando, inicia a fila com o processo que chegou
            if (vruntime.empty()) ps = q.front();

            // cria e adiciona o vruntime padrão (tempo_atual) para o processo
            _vruntime v = {.p = q.front(), .vtime = (float)time};
            vruntime.emplace_back(v);

            // remove da fila auxiliar
            q.pop();
        }

        // vruntime não vazio -> processo já rodando
        if (!vruntime.empty()) {

            // ordena do menor pro maior vruntime
            std::sort(vruntime.begin(), vruntime.end(), compareVruntime);

            // se o processo atual não tiver o menor vruntime
            if (vruntime[0].p->id != ps->id) {
                // adiciona sobrecarga
                if (p.overload) {
                    std::fill_n(timeline_end, p.overload, CPUTimeline::OVERLOAD);
                }

                // processo atual = processo com menor vruntime
                ps = vruntime[0].p;
            } else {
                // processo atual ainda tem menor vruntime

                // diminuir tempo de execução
                ps->burst_time--;

                // id do processo na timeline
                timeline.emplace_back(ps->id);

                for (auto it = vruntime.begin(); it < vruntime.end(); it++) {
                    if (it->p->id == ps->id) {
                        // aumentar vruntime
                        it->vtime += std::powf(1.25, ps->priority-1);

                        // processo acabou
                        if (!ps->burst_time) {
                            done++;

                            // desconsidera o processo do vruntime
                            vruntime.erase(it);
                        }
                        break;
                    }
                }
            }
        } else {
            // vruntime vazio -> cpu ociosa
            timeline.emplace_back(CPUTimeline::IDLE);
        }
        time++;
    }

    *t = timeline;
}
