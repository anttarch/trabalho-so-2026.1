#include "edf.h"
#include "../internals/handling.h"

void EDFScheduler::run(const payload &p, std::vector<int> *timeline) {
    int tempo = 0; //tempo atual da simulação
    int quantidade_processos = p.process_list.size(); //recebe a quantidade total de processos

    std::vector<int> tempo_restante(quantidade_processos); //tempo restante de execução de cada processo
    for (int i = 0; i < quantidade_processos; i++) {
        tempo_restante[i] = p.process_list[i].burst_time;
    }

    std::vector<bool> finalizado(quantidade_processos, false); //coloca na lista que nenhum dos processos terminou
    int processos_finalizados = 0; //variável pra contar os processos finalizados

    while (processos_finalizados < quantidade_processos) { //enquanto tiverem processos não finalizados
        int escolhido = -1; //inicialização, nenhum processo foi escolhido ainda

        for (int i = 0; i < quantidade_processos; i++) { //percorre todos os processos em busca do menor deadline
            if (finalizado[i]) { //se o processo tiver finalizado, pula
                continue;
            }
            if (p.process_list[i].absolute_arrival_time > tempo) { //se o processo ainda não chegou, pula
                continue;
            }
            if (escolhido == -1) { //se nenhum processo foi escolhido ainda, escolhe o primeiro que chegou
                escolhido = i;
            } else if (p.process_list[i].absolute_deadline < p.process_list[escolhido].absolute_deadline) { //compara deadlines
                escolhido = i;
            }
        }

        //se nenhum processo chegou, CPU fica ociosa
        if (escolhido == -1) {
            timeline->push_back(CPUTimeline::IDLE);
            tempo++;
            continue;
        }

        //executa o processo escolhido por apenas 1 unidade de tempo (preempção)
        timeline->push_back(p.process_list[escolhido].id); //coloca o id do processo na timeline
        tempo_restante[escolhido]--;
        tempo++;

        if (tempo_restante[escolhido] == 0) { //se o processo terminou sua execução
            finalizado[escolhido] = true; //muda o status para finalizado
            processos_finalizados++; //incrementa a quantidade de processos finalizados
        }
    }
}