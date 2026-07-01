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
        if (a.absolute_arrival_time != b.absolute_arrival_time) {
            return a.absolute_arrival_time < b.absolute_arrival_time;
        }

        return a.id < b.id;
    });

    std::vector<int> restante(quantidade_processos);
    for (int i = 0; i < quantidade_processos; i++) {
        restante[i] = processos[i].burst_time;
    }

    struct fila_item {
        int indice;
        int tempo_entrada;
    };

    std::deque<fila_item> fila_prontos;
    int idx_chegadas = 0;
    int processos_finalizados = 0;

    auto inserir_na_fila = [&](int indice, int tempo_entrada) {
        fila_item novo{indice, tempo_entrada};

        auto pos = fila_prontos.begin();
        while (pos != fila_prontos.end()) {
            const process &atual = processos[pos->indice];

            if (pos->tempo_entrada > novo.tempo_entrada) {
                break;
            }

            if (pos->tempo_entrada == novo.tempo_entrada && atual.id > processos[novo.indice].id) {
                break;
            }

            ++pos;
        }

        fila_prontos.insert(pos, novo);
    };

    auto adicionar_chegadas = [&]() {
        while (idx_chegadas < quantidade_processos && processos[idx_chegadas].absolute_arrival_time <= tempo) {
            inserir_na_fila(idx_chegadas, processos[idx_chegadas].absolute_arrival_time);
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

        int atual = fila_prontos.front().indice;
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

            inserir_na_fila(atual, tempo);
        } else {
            processos_finalizados++;
        }
    }
}