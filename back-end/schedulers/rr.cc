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

    // Trabalhamos sobre uma cópia para ordenar por chegada sem alterar a entrada original.
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

    // A fila guarda o instante em que cada processo entrou para definir uma ordem determinística
    // (tempo de entrada e, em caso de empate, menor ID).
    std::deque<fila_item> fila_prontos;
    int idx_chegadas = 0;
    int processos_finalizados = 0;

    // Insere preservando:
    // 1) menor tempo de entrada primeiro;
    // 2) em caso de empate, menor ID primeiro.
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

    // Captura todos os processos que já chegaram até o tempo atual.
    auto adicionar_chegadas = [&]() {
        while (idx_chegadas < quantidade_processos && processos[idx_chegadas].absolute_arrival_time <= tempo) {
            inserir_na_fila(idx_chegadas, processos[idx_chegadas].absolute_arrival_time);
            idx_chegadas++;
        }
    };

    while (processos_finalizados < quantidade_processos) {
        // Novas chegadas são incorporadas antes de selecionar o próximo processo.
        adicionar_chegadas();

        if (fila_prontos.empty()) {
            if (idx_chegadas < quantidade_processos) {
                // Sem ninguém pronto, a CPU fica ociosa até a próxima chegada.
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

            // Chegadas durante a execução entram na fila imediatamente para disputar a próxima rodada.
            adicionar_chegadas();
        }

        if (restante[atual] > 0) {
            // Se o processo não terminou, ele sofre sobrecarga antes de voltar para a fila.
            for (int i = 0; i < p.overload; i++) {
                timeline->push_back(CPUTimeline::OVERLOAD);
                tempo++;
            }

            // O reencaixe usa o tempo atual, então quem chegou durante a sobrecarga pode vir antes.
            inserir_na_fila(atual, tempo);
        } else {
            processos_finalizados++;
        }
    }
}