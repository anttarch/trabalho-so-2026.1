#include "edf.h"
#include "../internals/handling.h"

void EDFScheduler::run(const payload &p, std::vector<int> *timeline) {
    int tempo = 0; //tempo atual da simulação
    int quantidade_processos = p.process_list.size(); //recebe a quantidade total de processos

    std::vector<int> tempo_restante(quantidade_processos); //tempo restante de execução de cada processo
    for (int i = 0; i < quantidade_processos; i++) {
        tempo_restante[i] = p.process_list[i].burst_time;
    }

    std::vector<bool> finalizado(quantidade_processos, false); //nenhum processo terminou ainda
    int processos_finalizados = 0; //contador de processos finalizados
    int processo_anterior = -1; //índice do processo que rodou no tick anterior (-1 = nenhum ainda)

    while (processos_finalizados < quantidade_processos) { //enquanto tiverem processos não finalizados
        int escolhido = -1; //nenhum processo escolhido ainda

        for (int i = 0; i < quantidade_processos; i++) { //busca o processo com menor deadline
            if (finalizado[i]) {
                continue;
            }
            if (p.process_list[i].absolute_arrival_time > tempo) {
                continue;
            }
            if (escolhido == -1) {
                escolhido = i;
            } else if (p.process_list[i].absolute_deadline < p.process_list[escolhido].absolute_deadline) {
                escolhido = i;
            }
        }

        //se nenhum processo chegou, CPU fica ociosa
        if (escolhido == -1) {
            timeline->push_back(CPUTimeline::IDLE);
            tempo++;
            processo_anterior = -1; //zera o "processo anterior", pois a CPU ficou ociosa
            continue;
        }

        //se houve troca de processo em execução, cobra o tempo de sobrecarga
        if (processo_anterior != -1 && processo_anterior != escolhido && p.overload > 0) {
            for (int i = 0; i < p.overload; i++) {
                timeline->push_back(CPUTimeline::OVERLOAD);
                tempo++;
            }
        }

        //executa o processo escolhido por apenas 1 unidade de tempo (preempção)
        timeline->push_back(p.process_list[escolhido].id);
        tempo_restante[escolhido]--;
        tempo++;
        processo_anterior = escolhido; //atualiza o processo que rodou por último

        if (tempo_restante[escolhido] == 0) { //processo terminou
            finalizado[escolhido] = true;
            processos_finalizados++;
            processo_anterior = -1; //processo terminou, próxima escolha conta como "nova troca"
        }
    }
}