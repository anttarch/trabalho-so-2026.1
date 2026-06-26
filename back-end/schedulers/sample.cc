#include "sample.h"

#include <vector>

#include "../internals/handling.h"

void SampleScheduler::run(const payload &p, std::vector<int> *t) {
    // Cada payload contém os seguintes dados
    //
    // int quantum -> o tempo de quantum
    // int overload -> o tempo de sobrecarga
    // vector<process> -> lista de processos
    //
    // Cada processo na lista vem com:
    //
    // int id -> id do processo
    // string -> nome do processo
    // int absoluteArrivalTime -> tempo absoluto da chegada na cpu
    // int burstTime -> tempo total necessário para executar
    // int priority -> prioridade (1 = prioridade máxima)

    // Essa função é responsável por concentrar os dados necessários para a simulação
    // e repassar o resultado.
    // Para isso, é necessário computar a timeline como explicado a seguir

    // O necessário para a simulação:
    // vector<int> timeline -> ordem dos processos q a CPU vai executar
    //
    // exemplo:
    std::vector<int> timeline = { 1, 1, 2, 2, 2, 3 }; // Cada int > 0 é o id de um processo

    // A timeline pode conter tbm os momentos de sobrecarga e ociosidade
    //
    // exemplo: considere que o primeiro processo chega no segundo 2
    std::vector<int> timeline_ociosa = { CPUTimeline::IDLE, CPUTimeline::IDLE, 1 };

    // exemplo: sobrecarca de 1 segundo
    std::vector<int> timeline_ovld = { 1, CPUTimeline::OVERLOAD, 2 };

    // O indice de cada item da timeline representa o intervalo de tempo correspondente
    // exemplo: timeline[0] -> processo rodando de 0s a 1s...

    // por fim, é passado o resultado
    *t = timeline;

    // é isso.
}
