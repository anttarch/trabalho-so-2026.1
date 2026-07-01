#include "fifo.h"

#include <vector>

#include "../internals/handling.h"

void FIFOScheduler::run(const payload &p, std::vector<int> *timeline) {
    int tempo = 0;
    int quantidade_processos = static_cast<int>(p.process_list.size());

    std::vector<bool> finalizado(quantidade_processos, false);
    int processos_finalizados = 0;

    while (processos_finalizados < quantidade_processos) {
        int escolhido = -1;

        for (int i = 0; i < quantidade_processos; i++) {
            if (finalizado[i]) {
                continue;
            }

            if (p.process_list[i].absolute_arrival_time > tempo) {
                continue;
            }

            if (escolhido == -1 ||
                p.process_list[i].absolute_arrival_time < p.process_list[escolhido].absolute_arrival_time) {
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