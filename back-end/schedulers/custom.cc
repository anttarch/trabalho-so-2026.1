#include "custom.h"
#include <deque>
#include <algorithm>
#include "../internals/handling.h"

// Limiar de envelhecimento: quantidade de ticks que um processo pode
// esperar nas filas 2 ou 3 sem rodar antes de ser promovido para a fila 1.
static const int AGING_THRESHOLD = 20;

void CustomScheduler::run(const payload &p, std::vector<int> *timeline) {
    int tempo = 0; //tempo atual da simulação
    int quantidade_processos = p.process_list.size();

    std::vector<int> tempo_restante(quantidade_processos);
    for (int i = 0; i < quantidade_processos; i++) {
        tempo_restante[i] = p.process_list[i].burst_time;
    }

    std::vector<bool> chegou(quantidade_processos, false); //se já foi enfileirado
    std::vector<bool> finalizado(quantidade_processos, false);
    std::vector<int> tempo_sem_rodar(quantidade_processos, 0); //ticks esperando sem executar (envelhecimento)

    std::deque<int> fila_1; //alta prioridade - round robin, quantum = p.quantum
    std::deque<int> fila_2; //media prioridade - round robin, quantum = 2 * p.quantum
    std::vector<int> fila_3; //baixa prioridade - SJF não-preemptivo (roda até o fim)

    int processos_finalizados = 0;
    int rodando = -1; //índice do processo em execução na sessão atual (-1 = nenhum)
    int fila_da_sessao = 0; //fila de onde o processo em execução foi retirado
    int quantum_restante_sessao = 0; //ticks restantes na fatia de tempo atual
    int processo_anterior = -1; //id do último processo que ocupou a CPU (detecta troca de contexto)

    while (processos_finalizados < quantidade_processos) {
        // 1. enfileira processos que acabaram de chegar (sempre entram na fila 1)
        for (int i = 0; i < quantidade_processos; i++) {
            if (!chegou[i] && p.process_list[i].absolute_arrival_time <= tempo) {
                chegou[i] = true;
                fila_1.push_back(i);
            }
        }

        // 2. envelhecimento: quem espera nas filas 2 ou 3 acumula tempo de espera
        //    e é promovido para a fila 1 ao atingir o limiar (evita starvation)
        for (auto it = fila_2.begin(); it != fila_2.end();) {
            int idx = *it;
            tempo_sem_rodar[idx]++;
            if (tempo_sem_rodar[idx] >= AGING_THRESHOLD) {
                tempo_sem_rodar[idx] = 0;
                it = fila_2.erase(it);
                fila_1.push_back(idx);
            } else {
                ++it;
            }
        }
        for (auto it = fila_3.begin(); it != fila_3.end();) {
            int idx = *it;
            tempo_sem_rodar[idx]++;
            if (tempo_sem_rodar[idx] >= AGING_THRESHOLD) {
                tempo_sem_rodar[idx] = 0;
                it = fila_3.erase(it);
                fila_1.push_back(idx);
            } else {
                ++it;
            }
        }

        // 3. se não há sessão em andamento, seleciona o próximo processo pela hierarquia de filas
        if (rodando == -1) {
            if (!fila_1.empty()) {
                rodando = fila_1.front();
                fila_1.pop_front();
                fila_da_sessao = 1;
                quantum_restante_sessao = std::min(p.quantum, tempo_restante[rodando]);
            } else if (!fila_2.empty()) {
                rodando = fila_2.front();
                fila_2.pop_front();
                fila_da_sessao = 2;
                quantum_restante_sessao = std::min(p.quantum * 2, tempo_restante[rodando]);
            } else if (!fila_3.empty()) {
                // SJF: escolhe o processo com menor tempo restante
                int idx_escolhido = 0;
                for (int i = 1; i < (int)fila_3.size(); i++) {
                    if (tempo_restante[fila_3[i]] < tempo_restante[fila_3[idx_escolhido]]) {
                        idx_escolhido = i;
                    }
                }
                rodando = fila_3[idx_escolhido];
                fila_3.erase(fila_3.begin() + idx_escolhido);
                fila_da_sessao = 3;
                quantum_restante_sessao = tempo_restante[rodando]; //roda até o fim, sem preempção
            }

            if (rodando != -1) {
                tempo_sem_rodar[rodando] = 0;

                //se houve troca real de processo em execução, cobra o tempo de sobrecarga
                if (processo_anterior != -1 &&
                    processo_anterior != p.process_list[rodando].id &&
                    p.overload > 0) {
                    for (int i = 0; i < p.overload; i++) {
                        timeline->push_back(CPUTimeline::OVERLOAD);
                        tempo++;
                    }
                }
            }
        }

        //se nenhum processo está pronto, CPU fica ociosa
        if (rodando == -1) {
            timeline->push_back(CPUTimeline::IDLE);
            tempo++;
            processo_anterior = -1;
            continue;
        }

        // 4. executa 1 unidade de tempo do processo selecionado
        timeline->push_back(p.process_list[rodando].id);
        tempo_restante[rodando]--;
        quantum_restante_sessao--;
        tempo++;
        processo_anterior = p.process_list[rodando].id;

        // 5. processo terminou sua execução
        if (tempo_restante[rodando] == 0) {
            finalizado[rodando] = true;
            processos_finalizados++;
            rodando = -1;
            processo_anterior = -1;
            continue;
        }

        // 6. quantum da sessão esgotado sem o processo terminar -> rebaixamento
        if (quantum_restante_sessao == 0) {
            if (fila_da_sessao == 1) {
                fila_2.push_back(rodando);
            } else if (fila_da_sessao == 2) {
                fila_3.push_back(rodando);
            }
            // fila_da_sessao == 3 nunca cai aqui, pois ela roda até o fim
            tempo_sem_rodar[rodando] = 0;
            rodando = -1;
        }
    }
}