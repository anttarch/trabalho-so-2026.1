#include "sjf.h"
#include "../internals/handling.h"


void SJFScheduler::run(const payload &p, std::vector<int> *timeline) {
    int tempo = 0; //tempo atual da simulação

    int quantidade_processos = p.process_list.size(); //recebe a quantidade total de processos

    std::vector<bool> finalizado(quantidade_processos, false); //coloca na lista que nenhum dos processos terminou, ex [false, false, false]

    int processos_finalizados = 0; //variável pra contar os porcessos finalizados

    while (processos_finalizados < quantidade_processos) { //enquanto tiverem processos não finalizados
        int escolhido = -1; //inicialização, nenhum processo foi escolhido ainda

        for (int i = 0; i < quantidade_processos; i++) { //percorre todos os processos em busca do menor tempo de execução
            if (finalizado[i]) { //se o processo tiver finalizado [true], pula
                continue;
            }

            if (p.process_list[i].absolute_arrival_time > tempo) { //se o processo ainda não chegou, pula
                continue;
            }

            if (escolhido == -1) { //se nenhum processo chegou será escolhido o primeiro encontrado
                escolhido = i;
            } else if (p.process_list[i].burst_time < p.process_list[escolhido].burst_time) { //
                escolhido = i;
            }
        }

        //se nenhum processo chegou, CPU fica ociosa
        if (escolhido == -1) {
            timeline->push_back(CPUTimeline::IDLE);
            tempo++;
            continue;
        }

        for (int i = 0; i < p.process_list[escolhido].burst_time; i++) { //executa o processo escolhido até o fim
            timeline->push_back(p.process_list[escolhido].id);  //coloca o id do processo na timeline
            tempo++;
        }

        finalizado[escolhido] = true; //muda o status para finalizado
        processos_finalizados++; //incrmenta a quantidade de processos finalizados
    }
}