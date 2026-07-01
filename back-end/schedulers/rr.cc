#include "rr.h"

#include <algorithm>
#include <deque>
#include <vector>

#include "../internals/handling.h"

void RRScheduler::run(const payload &p, std::vector<int> *timeline) {
    int tempo = 0;
    int quantidade_processos = static_cast<int>(p.process_list.size());

    // quantum 0 não faz sentido para RR; garantimos ao menos 1 unidade por fatia
    int quantum = std::max(1, p.quantum);

    std::vector<process> processos = p.process_list;
    std::stable_sort(processos.begin(), processos.end(), [](const process &a, const process &b) {
        return a.absolute_arrival_time < b.absolute_arrival_time;
    });

    std::vector<int> restante(quantidade_processos);
    for (int i = 0; i < quantidade_processos; i++) {
        restante[i] = processos[i].burst_time;
    }

    std::deque<int> fila_prontos;
    int idx_chegadas = 0;
    int processos_finalizados = 0;

    auto adicionar_chegadas = [&]() {
        while (idx_chegadas < quantidade_processos && processos[idx_chegadas].absolute_arrival_time <= tempo) {
            fila_prontos.push_back(idx_chegadas);
            idx_chegadas++;
        }
    };

    while (processos_finalizados < quantidade_processos) {
        adicionar_chegadas();

        if (fila_prontos.empty()) {
            if (idx_chegadas < quantidade_processos) {
                timeline->push_back(CPUTimeline::IDLE);
                tempo++;
                continue;
            }
            break;
        }

        int atual = fila_prontos.front();
        fila_prontos.pop_front();

        int fatia = std::min(quantum, restante[atual]);
        for (int i = 0; i < fatia; i++) {
            timeline->push_back(processos[atual].id);
            restante[atual]--;
            tempo++;
            adicionar_chegadas();
        }

        if (restante[atual] > 0) {
            for (int i = 0; i < p.overload; i++) {
                timeline->push_back(CPUTimeline::OVERLOAD);
                tempo++;
            }

            fila_prontos.push_back(atual);
        } else {
            processos_finalizados++;
        }
    }
}