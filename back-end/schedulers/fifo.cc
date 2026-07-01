#include "fifo.h"

#include <vector>

#include "../internals/handling.h"

void FIFOScheduler::run(const payload &p, std::vector<int> *timeline) {
    int tempo = 0; // tempo atual da simulação
    int quantidade_processos = static_cast<int>(p.process_list.size()); // quantidade total de processos

    std::vector<bool> finalizado(quantidade_processos, false); // status de término de cada processo
    int processos_finalizados = 0; // contador de quantos já finalizaram

    while (processos_finalizados < quantidade_processos) {
        int escolhido = -1; // índice do processo escolhido para executar

        // escolhe o processo que já chegou e possui menor tempo de chegada (ordem FIFO)
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

        // se ainda não existe processo pronto, a CPU fica ociosa por 1 unidade
        if (escolhido == -1) {
            timeline->push_back(CPUTimeline::IDLE);
            tempo++;
            continue;
        }

        // FIFO é não-preemptivo: executa o processo até o fim
        for (int i = 0; i < p.process_list[escolhido].burst_time; i++) {
            timeline->push_back(p.process_list[escolhido].id);
            tempo++;
        }

        // ao terminar, marca o processo como finalizado
        finalizado[escolhido] = true;
        processos_finalizados++;
    }
}