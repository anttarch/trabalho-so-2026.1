#include "priority.h"
#include "../internals/handling.h"


void PriorityScheduler::run(const payload &p, std::vector<int> *timeline) {
    int tempo = 0;

    int quantidade_processos = p.process_list.size(); //define o número total de processos

    std::vector<int> restante(quantidade_processos); // cria uma lista para armazenar os tempos restantes de execução de cada processo

    std::vector<bool> finalizado(quantidade_processos, false); //lista com status de cada processo 

    for (int i = 0; i < quantidade_processos; i++) {  
        restante[i] = p.process_list[i].burst_time; //aloca os tempos de execução na lista 
    }

    int processos_finalizados = 0;

    int processo_atual = -1; //que está sendo executado agora (nenhum)

    while (processos_finalizados < quantidade_processos) { //enquanto existem processos a serem executados 
        int maior = -1; //guardará o processo com a maior prioiridade 

        for (int i = 0; i < quantidade_processos; i++) { //procura 
            if (finalizado[i]) { //já tiver finalizado, pula
                continue;
            }

            if (p.process_list[i].absolute_arrival_time > tempo) { //caso não tenha chegado, pula 
                continue;
            }

            if (maior == -1) { //se nao tiver ninguem, escolhe o primeiro
                maior = i;
            } else if (p.process_list[i].priority < p.process_list[maior].priority) { //escolhe que tem maior prioridade (sendo 1 a mais alta)
                maior = i;
            }
        }

        //se nenhum processo chegou ainda, CPU fica ociosa
        if (maior == -1) {
            timeline->push_back(CPUTimeline::IDLE);
            tempo++;
            processo_atual = -1;
            continue;
        }

        //preempção
        if (processo_atual != -1 && // existia um processo executando
            processo_atual != maior && // existe um outro processo com maior prioridade
            !finalizado[processo_atual]) { //o processo que estava executando não acabou

            for (int i = 0; i < p.overload; i++) { //sobrecarga (p.overload vem do front)
                timeline->push_back(CPUTimeline::OVERLOAD);
                tempo++;
            }

            processo_atual = -1;
            continue; //volta pra busca
        }

        //executa o processo escolhido por 1 unidade de tempo
        timeline->push_back(p.process_list[maior].id);
        tempo++;

        restante[maior]--;
        processo_atual = maior;

        if (restante[maior] == 0) { //se o processo finalizou 
            finalizado[maior] = true;
            processos_finalizados++;
            processo_atual = -1;
        }
    } 
}